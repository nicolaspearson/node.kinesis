# Node Kinesis

This is Node JS Kinesis app, using AWS, Typescript, and MySQL. It monitors a MySQL bin log and pushes the streaming database change into a kinesis stream. Create a MySQL replica user in order to start streaming database changes to the bin log.

### How do I get set up?

*   Install a text editor, e.g. Visual Studio Code is recommended
*   Install Node, e.g. brew install node
*   Clone the repository

### Running the project

1.  Run `npm / yarn install`
2.  Run `npm run build` to compile the typescript into the dist folder.
3.  Run `npm start` to run the application.

## Technologies used:

### For the application

*   [Config](https://www.npmjs.com/package/config)
*   [MySQL](https://www.npmjs.com/package/mysql)
*   [Type DI](https://www.npmjs.com/package/typedi)
*   [Typescript](https://www.typescriptlang.org/)
*   [Winston](https://www.npmjs.com/package/winston)

### Contribution guidelines

*   Code reviews are done via pull requests
*   Never commit directly to develop, staging, or master
