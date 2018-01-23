import { Container } from 'typedi';
import { Application } from './app/Application';

/* tslint:disable no-console */
process.on('unhandledRejection', (reason, promise) => {
	console.error(reason, 'Unhandled Rejection at Promise', promise);
	process.exitCode = 1;
});
process.on('uncaughtException', error => {
	console.error(error, 'Uncaught Exception thrown');
	process.exitCode = 1;
});

async function createApp() {
	try {
		const application: Application = Container.get(Application);
		await application.setupApplication();
	} catch (error) {
		console.error(error, 'An error occurred starting the application');
		process.exitCode = 1;
	}
}

createApp();
