import sdk, { DeviceCreator, DeviceCreatorSettings, Settings, ScryptedDeviceBase, ScryptedDeviceType, ScryptedInterface, Setting, SettingValue } from "@scrypted/sdk";
import { getTargets, GreenapiNotifier, getStorageSettingsDic } from "./notifier";
import { randomBytes } from "crypto";
import { StorageSettings } from "@scrypted/sdk/storage-settings";
const { deviceManager } = sdk;

class GreenapiProvider extends ScryptedDeviceBase implements DeviceCreator, Settings {
    devices = new Map<string, any>();

    storageSettings = new StorageSettings(this, getStorageSettingsDic(true, false));


    constructor() {
        super();

        this.storageSettings.settings.loadContacts.onPut = async () => {
            const { apiToken, idInstance } = this.storageSettings.values;
            const contacts = await getTargets(idInstance, apiToken);
            this.storageSettings.settings.loadContacts.choices = contacts;
        }
    }
    getSettings(): Promise<Setting[]> {
        return this.storageSettings.getSettings();
    }
    putSetting(key: string, value: SettingValue): Promise<void> {
        return this.storageSettings.putSetting(key, value);
    }

    getScryptedDeviceCreator(): string {
        return 'Greenapi notifier';
    }

    getDevice(nativeId: string) {
        let ret = this.devices.get(nativeId);
        if (!ret) {
            ret = this.createNotifier(nativeId);
            if (ret)
                this.devices.set(nativeId, ret);
        }
        return ret;
    }

    updateDevice(nativeId: string, name: string, interfaces: string[], type?: ScryptedDeviceType) {
        return deviceManager.onDeviceDiscovered({
            nativeId,
            name,
            interfaces,
            type: type || ScryptedDeviceType.Notifier,
            info: deviceManager.getNativeIds().includes(nativeId) ? deviceManager.getDeviceState(nativeId)?.info : undefined,
        });
    }

    async createDevice(settings: DeviceCreatorSettings, nativeId?: string): Promise<string> {
        nativeId ||= randomBytes(4).toString('hex');
        const target = String(settings.target)?.split(':')[0];
        const name = `GreenAPI ${target}`;
        await this.updateDevice(nativeId, name, [ScryptedInterface.Settings, ScryptedInterface.Notifier]);
        const device = await this.getDevice(nativeId) as GreenapiNotifier;
        nativeId = device.nativeId;

        device.storageSettings.putSetting('apiToken', this.storageSettings.values.apiToken);
        device.storageSettings.putSetting('idInstance', this.storageSettings.values.idInstance);
        device.storageSettings.putSetting('target', settings.target);
        device.storageSettings.settings.target.choices = [String(settings.target)];

        return nativeId;
    }

    async getCreateDeviceSettings(): Promise<Setting[]> {
        try {
            const storageSettings = new StorageSettings(this, getStorageSettingsDic(false, true));
            const { apiToken, idInstance } = this.storageSettings.values;
            const contacts = await getTargets(idInstance, apiToken);
            storageSettings.settings.target.choices = contacts;
            this.console.log(contacts);

            return await storageSettings.getSettings();
        } catch (e) {
            this.console.log(e);
        }
    }

    createNotifier(nativeId: string) {
        return new GreenapiNotifier(nativeId);
    }
}

export default GreenapiProvider;
