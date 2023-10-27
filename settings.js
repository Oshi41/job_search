import fs from "fs";
import os from "os";
import path from "path";
import {join_mkfile, question, Settings} from 'oshi_utils';

const settings_path = path.join(os.homedir(), 'job_search', 'settings.json');
if (!fs.existsSync(path.dirname(settings_path)))
    fs.mkdirSync(path.dirname(settings_path));

/**
 * @typedef {object} SettingsType
 * @property {{login: string, pass: string, search: string}} linkedin
 */

/**
 *
 * @returns {Promise<{SettingsType}>}
 */
const get_default_settings = async ()=>{
    return {
        linkedin:{
            login: await question('Enter your LinkedIn login', 'string'),
            pass: await question('Enter your LinkedIn password', 'string'),
            search: await question('Enter LinkedIn jobs search request', 'string'),
        },
    }
}

/**
 * @returns {Promise<SettingsType>}
 */
export const get_settings = async ()=>{
    let filepath = join_mkfile(os.homedir(), 'job_search', 'settings.json');
    // let pass = await question('Enter your OS password', 'string');
    let pass = 'os.1Fhrfif$';
    let settings = new Settings(filepath, pass);
    return await settings.read(get_default_settings);
}
