/* @flow */

import $logger from 'beaver-logger/client';

import { config, ENV } from './config';
import { initLogger, checkForCommonErrors, beacon, setLogLevel } from './lib';
import { enableCheckoutIframe } from './components';
import { setupBridge } from './compat';

import { SyncPromise } from 'sync-browser-mocks/src/promise';

function domainToEnv(domain : string) : ?string {
    for (let env of Object.keys(config.paypalUrls)) {
        if (config.paypalUrls[env] === domain) {
            return env;
        }
    }
}

function setDomainEnv(domain : string) {
    let currentDomainEnv = domainToEnv(domain);

    if (currentDomainEnv && currentDomainEnv !== 'test') {
        config.env = currentDomainEnv;
    }
}

setDomainEnv(`${window.location.protocol}//${window.location.host}`);

initLogger();

SyncPromise.onPossiblyUnhandledException((err : Error) => {

    beacon(`unhandled_error`, {
        message: err ? err.toString() : 'undefined',
        stack: err.stack || err.toString(),
        errtype: ({}).toString.call(err)
    });
});


function getCurrentScript() : ? HTMLScriptElement {

    let scripts = Array.prototype.slice.call(document.getElementsByTagName('script'));

    for (let script of scripts) {
        if (script.src && script.src.replace(/^https?:/, '').split('?')[0] === config.scriptUrl || script.hasAttribute('data-paypal-checkout')) {
            return script;
        }

        if (script.src && script.src.indexOf('paypal.checkout.v4.js') !== -1) {
            return script;
        }
    }

    if (document.currentScript) {
        $logger.debug(`current_script_not_recognized`, { src: document.currentScript.src });
    }
}

let currentScript = getCurrentScript();
let currentProtocol = window.location.protocol.split(':')[0];


type SetupOptions = {
    env? : ?string,
    stage? : ?string,
    apiStage? : ?string,
    paypalUrl? : ?string,
    state? : ?string,
    ppobjects? : ?boolean,
    lightbox? : ?boolean,
    bridge? : ?boolean,
    logLevel? : ?string
};

export function setup({ env, stage, apiStage, paypalUrl, state, ppobjects, lightbox, bridge, logLevel } : SetupOptions = {}) {

    checkForCommonErrors();

    if (env) {
        if (!config.paypalUrls[env]) {
            throw new Error(`Invalid env: ${env}`);
        }

        delete config.env;
        config.env = env;
    }

    if (stage) {
        delete config.stage;
        config.stage = stage;
        if (!env) {
            delete config.env;
            config.env = ENV.STAGE;
        }
    }

    if (apiStage) {
        delete config.apiStage;
        config.apiStage = apiStage;
    }

    if (paypalUrl) {
        delete config.paypalUrl;
        config.paypalUrl = paypalUrl;
        setDomainEnv(config.paypalUrl);
    }

    if (state) {
        delete config.state;
        config.state = state;
    }

    if (ppobjects) {
        config.ppobjects = true;
    }

    if (lightbox) {
        enableCheckoutIframe();
    }

    if (bridge) {
        setupBridge(config.env);
    }

    if (logLevel) {
        setLogLevel(logLevel);
    }

    $logger.info(`setup_${config.env}`);

    $logger.debug(`current_protocol_${currentProtocol}`);
}

if (currentScript) {

    setup({
        env:       currentScript.getAttribute('data-env'),
        stage:     currentScript.getAttribute('data-stage'),
        apiStage:  currentScript.getAttribute('data-api-stage'),
        paypalUrl: currentScript.getAttribute('data-paypal-url'),
        state:     currentScript.getAttribute('data-state'),
        lightbox:  currentScript.hasAttribute('data-enable-lightbox'),
        bridge:    currentScript.hasAttribute('data-enable-bridge'),
        logLevel:  currentScript.getAttribute('data-log-level'),
        ppobjects: true
    });

    let scriptProtocol = currentScript.src.split(':')[0];

    $logger.debug(`current_script_protocol_${scriptProtocol}`);
    $logger.debug(`current_script_${ currentProtocol === scriptProtocol ? 'match' : 'mismatch' }_protocol`);

} else {
    $logger.debug(`no_current_script`);

    if (document.currentScript) {
        $logger.debug(`current_script_not_recognized`, { src: document.currentScript.src });
    }
}
