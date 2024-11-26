import sdk, { ScryptedDeviceBase, Notifier, Settings, NotifierOptions, MediaObject, Setting, SettingValue } from '@scrypted/sdk';
import { StorageSettings, StorageSettingsDict } from '@scrypted/sdk/storage-settings';
import axios from 'axios';
const { mediaManager } = sdk;

export const getTargets = async (idInstance: string, apiTokenInstance: string) => {
    const url = `https://7103.api.greenapi.com/waInstance${idInstance}/getContacts/${apiTokenInstance}`;

    const contacts = await axios.get(url);
    return contacts.data.map(({ name, id }) => `${name}:${id}`);
}

type StorageSettingKeys = 'idInstance' | 'apiToken' | 'loadContacts' | 'target' | 'error';

export const getStorageSettingsDic = (forPlugin: boolean, forCreation: boolean): StorageSettingsDict<StorageSettingKeys> => {
    return {
        idInstance: {
            title: 'Instance ID',
            hide: forCreation,
        },
        apiToken: {
            title: 'API token',
            type: 'password',
            hide: forCreation,
        },
        loadContacts: {
            title: 'Load targets',
            type: 'button',
            hide: forCreation,
        },
        error: {
            title: 'Click the load target button first',
            type: 'html',
            hide: true,
        },
        target: {
            title: 'Target',
            type: 'string',
            choices: [],
            hide: forPlugin,
        }
    }
}

export class GreenapiNotifier extends ScryptedDeviceBase implements Notifier, Settings {
    storageSettings = new StorageSettings(this, getStorageSettingsDic(false, false));

    constructor(nativeId: string) {
        super(nativeId);

        this.storageSettings.settings.loadContacts.onPut = async () => {
            const { apiToken, idInstance } = this.storageSettings.values;
            const contacts = await getTargets(idInstance, apiToken);
            this.storageSettings.settings.target.choices = contacts;
        }
    }

    async sendNotification(title: string, options?: NotifierOptions, media?: MediaObject | string, icon?: MediaObject | string): Promise<void> {
        const { target } = this.storageSettings.values;
        const body = options.body ?? options.bodyWithSubtitle;
        let message = title;
        if (body) {
            message += `\n ${body}`;
        }
        const chatId = target.split(':')[1];

        try {
            if (media) {
                if (typeof media !== 'string') {
                    media = await mediaManager.convertMediaObjectToUrl(media as MediaObject, 'image/*');
                }
                const url = `https://7103.api.greenapi.com/waInstance${this.storageSettings.values.idInstance}/sendFileByUrl/${this.storageSettings.values.apiToken}`;

                const response = await axios.post(url, { chatId, caption: message, urlFile: media, fileName: 'image.jpeg' });
                return response.data;
            } else {
                const url = `https://7103.api.greenapi.com/waInstance${this.storageSettings.values.idInstance}/sendMessage/${this.storageSettings.values.apiToken}`;

                const response = await axios.post(url, { chatId, message });
                return response.data;
            }
        } catch (e) {
            this.console.log('Error sending notification', e);
        }
    }

    async getSettings(): Promise<Setting[]> {
        return this.storageSettings.getSettings();
    }

    async putSetting(key: string, value: SettingValue): Promise<void> {
        return this.storageSettings.putSetting(key, value);
    }
}
