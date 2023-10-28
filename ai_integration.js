import * as implementation from './ai/bing.js';

export async function init(){
    await implementation.init();
}

export async function ask(text){
    return await implementation.ask(text);
}