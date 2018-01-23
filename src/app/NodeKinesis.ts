import { Kinesis } from 'aws-sdk';
import * as config from 'config';
import * as stream from 'stream';
import * as through2 from 'through2';
import { Container, Inject } from 'typedi';
import * as ZongJi from 'zongji';

import Guid from '../utils/Guid';
import NumberUtils from '../utils/NumberUtils';
import AppLogger from './AppLogger';
import { MySql } from './MySql';

export class NodeKinesis {
	@Inject() private appLogger: AppLogger;

	constructor() {
		// Empty constructor
	}

	public async setupNodeKinesis(yamlConfig: string): Promise<any> {
		let zongji: any;
		try {
			// Setup MySql
			const mySql: MySql = Container.get(MySql);
			await mySql.setupMySql(yamlConfig);
			const connection = await mySql.getConnection();
			zongji = new ZongJi(connection.config, {});

			const kinesis: Kinesis = new Kinesis({
				region: config.get('server.kinesis.region'),
				accessKeyId: config.get('server.kinesis.accessKeyId'),
				secretAccessKey: config.get('server.kinesis.secretAccessKey')
			});

			const inputStreams: Map<string, stream.PassThrough> = new Map();

			zongji.on('binlog', (evt: any) => {
				if (
					evt &&
					evt.rows &&
					evt.rows.length > 0 &&
					evt.getEventName() !== 'tablemap'
				) {
					for (const row of evt.rows) {
						try {
							const dataRow = JSON.stringify(
								row.after || row.before || row
							);
							const tableName =
								evt.tableMap[evt.tableId].tableName;
							const streamName: string = config.get(
								`server.kinesis.${yamlConfig}.mapping.${tableName}`
							);
							const batchSize = Number(
								config.get(
									`server.kinesis.${yamlConfig}.size.${tableName}`
								)
							);
							if (dataRow && streamName) {
								// Check if we have a stream
								let inputStream: stream.PassThrough | undefined;
								if (inputStreams.has(streamName)) {
									inputStream = inputStreams.get(streamName);
									if (inputStream) {
										inputStream.push(dataRow);
									}
								} else {
									inputStream = new stream.PassThrough({
										highWaterMark: 1024 * 1024
									});
									inputStreams.set(streamName, inputStream);
									inputStream.push(dataRow);

									this.processStream(
										kinesis,
										inputStream,
										streamName,
										batchSize
									);
									this.appLogger.winston.debug(
										`Node Kinesis: Stream created: ${streamName} on ${yamlConfig}`
									);
								}
							} else {
								this.appLogger.winston.error(
									`Undefined Row: ${JSON.stringify(row)}`
								);
							}
						} catch (error) {
							this.appLogger.winston.error(
								'Failed Inserting Stream Value',
								error
							);
						}
					}
				}
			});

			zongji.start({
				excludeEvents: ['rotate'],
				includeEvents: [
					'writerows',
					'updaterows',
					'deleterows',
					'tablemap'
				],
				includeSchema: {
					schema_1: config.get(`server.kinesis.${yamlConfig}.tables`)
				},
				serverId: config.get('server.serverId')
			});
			this.appLogger.winston.debug(
				`Node Kinesis: Started: ${yamlConfig}`
			);
		} catch (error) {
			throw error;
		}

		process.on('SIGINT', () => {
			if (zongji) {
				this.appLogger.winston.debug(
					'SIGINT event received. Stopping Node Kinesis'
				);
				zongji.stop();
			}
		});
	}

	private processStream(
		kinesis: Kinesis,
		inputStream: stream.PassThrough,
		streamName: string,
		batchSize: number
	) {
		const self: NodeKinesis = this;
		let batchBuffer: any[] = [];
		const pushStream = inputStream.pipe(
			through2(
				{
					highWaterMark: 1024 * 1024
				},
				function handleWrite(chunk, encoding, done) {
					this.push(chunk, encoding);
					done();
				}
			)
		);

		const batchStream = pushStream.pipe(
			through2(
				{
					objectMode: true,
					highWaterMark: batchSize
				},
				function handleWrite(item, encoding, done) {
					batchBuffer.push(item);
					// If our batch buffer has reached the desired size, push the batched
					// items onto the READ buffer of the transform stream.
					if (batchBuffer.length >= batchSize) {
						this.push(batchBuffer);
						// Reset for next batch
						batchBuffer = [];
					}
					done();
				},
				function handleFlush(done) {
					// It's possible that the last few items were not sufficient (in count)
					// to fill-out an entire batch. As such, if there are any straggling
					// items, push them out as the last batch.
					if (batchBuffer.length && batchBuffer.length > 0) {
						this.push(batchBuffer);
					}
					done();
				}
			)
		);

		const kinesisStream = batchStream.pipe(
			through2(
				{
					objectMode: true,
					highWaterMark: batchSize
				},
				function handleWrite(batch: any, encoding: any, done: any) {
					const batchArray: any[] = [];
					const guid = Guid.newGuid();
					for (const item of batch) {
						batchArray.push({
							PartitionKey: `partitionKey-${guid}-${NumberUtils.getRandomInt(
								1,
								100000
							)}`,
							Data: item
						});
					}

					self.appLogger.winston.debug(
						`Batch being processed: ${
							batchArray.length
						} : ${streamName}`
					);

					// tslint:disable no-null-keyword
					// Push the data into kinesis
					kinesis.putRecords(
						{
							Records: batchArray,
							StreamName: streamName
						},
						(error, data) => {
							if (error) {
								done(error);
							}
							done(null, data);
						}
					);
					// tslint:enable no-null-keyword
				}.bind(self)
			)
		);

		kinesisStream.on('data', results => {
			this.appLogger.winston.debug(
				`Batch completed at: ${new Date().toISOString()}`
			);
		});
		kinesisStream.on('finish', () => {
			this.appLogger.winston.debug(
				`Stream completed at: ${new Date().toISOString()}`
			);
		});
		kinesisStream.on('close', () => {
			this.appLogger.winston.debug(
				`Stream closed at: ${new Date().toISOString()}`
			);
		});
	}
}
