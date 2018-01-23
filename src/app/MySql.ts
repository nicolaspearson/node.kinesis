import * as config from 'config';
import * as mysql from 'mysql';
import { Inject } from 'typedi';

import AppLogger from './AppLogger';

export class MySql {
	@Inject() private appLogger: AppLogger;

	private static pool: mysql.Pool;

	constructor() {
		// Empty constructor
	}

	public async setupMySql(yamlConfig: string): Promise<mysql.Pool> {
		try {
			MySql.pool = this.createPool(yamlConfig);
			this.appLogger.winston.debug('MySql: Initialized');
			return MySql.pool;
		} catch (error) {
			throw error;
		}
	}

	private createPool(yamlConfig: string): mysql.Pool {
		return mysql.createPool({
			connectionLimit: config.get(`server.db.${yamlConfig}.connectionLimit`),
			host: config.get(`server.db.${yamlConfig}.host`),
			user: config.get(`server.db.${yamlConfig}.username`),
			password: config.get(`server.db.${yamlConfig}.password`),
			port: config.get(`server.db.${yamlConfig}.port`),
			dateStrings: true
		});
	}

	public static destroyPool() {
		if (this.pool) {
			this.pool.end();
		}
	}

	public async getConnection(): Promise<mysql.Connection> {
		try {
			const result: mysql.Connection = await new Promise<
				mysql.Connection
			>((resolve, reject) => {
				MySql.pool.getConnection((err, conn) => {
					if (err) {
						reject(err);
					}
					this.appLogger.winston.debug('MySql: Connected');
					resolve(conn);
				});
			});
			return result;
		} catch (error) {
			this.appLogger.winston.error('Get Connection Failed', error);
			throw error;
		}
	}

	public async keepAlive() {
		try {
			const connection = await this.getConnection();
			connection.ping();
			connection.end();
		} catch (error) {
			this.appLogger.winston.error('Keep Alive Failed', error);
		}
	}

	public async runMysqlQuery(queryString: string): Promise<any[]> {
		try {
			const connection: any = await this.getConnection();
			const [rows, fields] = await connection.query(queryString);
			return [rows, fields];
		} catch (error) {
			throw error;
		}
	}
}
