import Module from "./module";

type PortType = {
	postMessage: (msg: any) => void;
}

export function installPort(module: Module) {
	let port: PortType | null = null;
	let count = 0;

	function initialize() {
		try {
			// Try connecting with externally_connectable first.
			const cp = port = chrome.runtime.connect(document.body.dataset.ffzExtension!, {
				name: 'ffz-ext-port'
			});

			cp.onMessage.addListener(msg => {
				count = 0;
				module.emit('ext:message', msg);
			});

			cp.onDisconnect.addListener(p => {
				module.log.warn('Extension port disconnected.', (p as any)?.error ?? chrome.runtime.lastError);
				port = null;
				count++;
				if ( count < 10 )
					initialize();
			});

			return;
		} catch(err) {
			module.log.warn('Unable to connect using externally_connectable, falling back to bridge.');
		}

		window.addEventListener('message', evt => {
			if ( evt.source !== window || ! evt.data?.ffz_from_worker )
				return;

			module.emit('ext:message', evt.data);
		});

		port = {
			postMessage(msg) {
				window.postMessage({
					ffz_to_worker: true,
					...msg
				}, window.location.origin);
			}
		};
	}

	module.on('ext:post-message', msg => {
		if ( ! port )
			initialize();

		try {
			port!.postMessage(msg);
		} catch(err) {
			// Try re-initializing once.
			port = null;
			initialize();

			try {
				port!.postMessage(msg);
			} catch(err) {
				module.log.error('Error posting message to extension port.', err);
			}
		}
	});

	initialize();
}
