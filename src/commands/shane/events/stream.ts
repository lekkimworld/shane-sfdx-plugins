import { flags, SfdxCommand } from '@salesforce/command';
import { StreamingClient } from '@salesforce/core';
import * as fs from 'fs-extra';
import { PlatformEvent } from '../../../shared/typeDefs';

import { replay, dir } from '../../../shared/flags';

const writeJSONOptions = {
    spaces: 2
};

export default class EventStream extends SfdxCommand {
    public static examples = [
        'sfdx shane:events:stream -e SomeEvent__e // subscribe to an event stream',
        'sfdx shane:events:stream -e SomeEvent__e -d myDir // stream events to myDir'
    ];

    protected static flagsConfig = {
        event: flags.string({ char: 'e', description: `the platform event's api name` }),
        dir,
        replay
    };

    protected static requiresUsername = true;

    public async run(): Promise<any> {
        const streamProcessor = message => {
            this.ux.logJson(message);
            return { completed: false };
        };

        const streamProcessorToFile = (message: PlatformEvent) => {
            const filename = `${this.flags.dir}/${message.event.replayId}.json`;
            fs.outputJSON(filename, message, writeJSONOptions, () => {});
            return { completed: false };
        };

        const endpoint = `/event/${this.flags.event}`;
        // create a client
        const options = new StreamingClient.DefaultOptions(this.org, endpoint, this.flags.dir ? streamProcessorToFile : streamProcessor);
        options.apiVersion = await this.org.retrieveMaxApiVersion();
        // options.subscribeTimeout = new Duration(60 * 100);
        const client = await StreamingClient.create(options);
        client.replay(this.flags.replay);

        await client.handshake();
        await client.subscribe(async () => {
            this.ux.log(`Listening on ${endpoint}... (ctrl-c to exit)`);
        });
    }
}
