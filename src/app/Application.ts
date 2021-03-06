import 'reflect-metadata';
import 'source-map-support/register';
import 'ts-helpers';

import { Container, Inject, Service } from 'typedi';

import AppLogger from './AppLogger';
import { MySql } from './MySql';
import { NodeKinesis } from './NodeKinesis';

@Service()
export class Application {
	@Inject() private appLogger: AppLogger;

	constructor() {
		// Empty constructor
	}

	public async setupApplication() {
		this.appLogger.winston.debug('Application: Configuration Started');
		try {
			// Setup Kinesis for Database 1
			const database1Kinesis: NodeKinesis = Container.get(NodeKinesis);
			await database1Kinesis.setupNodeKinesis('database_1');
			this.appLogger.winston.debug('Application: Server Started');
		} catch (error) {
			this.appLogger.winston.error(
				'Failed Configuring The Application',
				error
			);
		}

		process.on('SIGINT', () => {
			this.appLogger.winston.debug(
				'SIGINT event received. Stopping Application'
			);
			MySql.destroyPool();
			process.exitCode = 1;
		});
	}
}
