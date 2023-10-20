const XMLReadyStateMap = [
  'UNSENT',
  'OPENED',
  'HEADERS_RECEIVED',
  'LOADING',
  'DONE',
];

class EventSource {
  ERROR = -1;
  CONNECTING = 0;
  OPEN = 1;
  CLOSED = 2;

  constructor(url, options = {}) {
    this.lastEventId = null;
    this.lastIndexProcessed = 0;
    this.eventType = undefined;
    this.status = this.CONNECTING;

    this.eventHandlers = {
      open: [],
      message: [],
      error: [],
      close: [],
    };

    this.method = options.method || 'GET';
    this.timeout = options.timeout ?? 0;
    this.timeoutBeforeConnection = options.timeoutBeforeConnection ?? 500;
    this.withCredentials = options.withCredentials || false;
    this.headers = options.headers || {};
    this.body = options.body || undefined;
    this.debug = options.debug || false;
    this.interval = options.pollingInterval ?? 5000;

    this._xhr = null;
    this._pollTimer = null;

    if (!url || (typeof url !== 'string' && typeof url.toString !== 'function')) {
      throw new SyntaxError('[EventSource] Invalid URL argument.');
    }

    if (typeof url.toString === 'function') {
      this.url = url.toString();
    } else {
      this.url = url;
    }

    this._pollAgain(this.timeoutBeforeConnection, true);
  }

  _pollAgain(time, allowZero) {
    if (time > 0 || allowZero) {
      this._logDebug(`[EventSource] Will open new connection in ${time} ms.`);
      this._pollTimer = setTimeout(() => {
        this.open();
      }, time);
    }
  }

  open() {
    try {
      this.lastIndexProcessed = 0;
      this.status = this.CONNECTING;

      this._xhr = new XMLHttpRequest();
      this._xhr.open(this.method, this.url, true);

      if (this.withCredentials) {
        this._xhr.withCredentials = true;
      }

      this._xhr.setRequestHeader('Accept', 'text/event-stream');
      this._xhr.setRequestHeader('Cache-Control', 'no-cache');
      this._xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

      if (this.headers) {
        for (const [key, value] of Object.entries(this.headers)) {
          this._xhr.setRequestHeader(key, value);
        }
      }

      if (this.lastEventId !== null) {
        this._xhr.setRequestHeader('Last-Event-ID', this.lastEventId);
      }

      this._xhr.timeout = this.timeout;

      this._xhr.onreadystatechange = () => {
        if (this.status === this.CLOSED) {
          return;
        }

        const xhr = this._xhr;

        this._logDebug(`[EventSource][onreadystatechange] ReadyState: ${XMLReadyStateMap[xhr.readyState] || 'Unknown'}(${xhr.readyState}), status: ${xhr.status}`);

        if (![XMLHttpRequest.DONE, XMLHttpRequest.LOADING].includes(xhr.readyState)) {
          return;
        }

        if (xhr.status >= 200 && xhr.status < 400) {
          if (this.status === this.CONNECTING) {
            this.status = this.OPEN;
            this.dispatch('open', { type: 'open' });
            this._logDebug('[EventSource][onreadystatechange][OPEN] Connection opened.');
          }

          this._handleEvent(xhr.responseText || '');

          if (xhr.readyState === XMLHttpRequest.DONE) {
            this._logDebug('[EventSource][onreadystatechange][DONE] Operation done.');
            this._pollAgain(this.interval, false);
          }
        } else if (xhr.status !== 0) {
          this.status = this.ERROR;
          this.dispatch('error', {
            type: 'error',
            message: xhr.responseText,
            xhrStatus: xhr.status,
            xhrState: xhr.readyState,
          });

          if (xhr.readyState === XMLHttpRequest.DONE) {
            this._logDebug('[EventSource][onreadystatechange][ERROR] Response status error.');
            this._pollAgain(this.interval, false);
          }
        }
      };

      this._xhr.onerror = () => {
        if (this.status === this.CLOSED) {
          return;
        }

        this.status = this.ERROR;
        this.dispatch('error', {
          type: 'error',
          message: this._xhr.responseText,
          xhrStatus: this._xhr.status,
          xhrState: this._xhr.readyState,
        });
      };

      if (this.body) {
        this._xhr.send(this.body);
      } else {
        this._xhr.send();
      }

      if (this.timeout > 0) {
        setTimeout(() => {
          if (this._xhr.readyState === XMLHttpRequest.LOADING) {
            this.dispatch('error', { type: 'timeout' });
            this.close();
          }
        }, this.timeout);
      }
    } catch (e) {
      this.status = this.ERROR;
      this.dispatch('error', {
        type: 'exception',
        message: e.message,
        error: e,
      });
    }
  }

  _logDebug(...msg) {
    if (this.debug) {
      console.debug(...msg);
    }
  }

  _handleEvent(response) {
    const parts = response.substr(this.lastIndexProcessed).split('\n');
    
    const indexOfDoubleNewline = response.lastIndexOf('\n\n');
    if (indexOfDoubleNewline != -1) {
      this.lastIndexProcessed = indexOfDoubleNewline + 2;
    }
    
    let data = [];
    let retry = 0;
    let line = '';

    for (let i = 0; i < parts.length; i++) {
      line = parts[i].replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, '');
      if (line.indexOf('event') === 0) {
        this.eventType = line.replace(/event:?\s*/, '');
      } else if (line.indexOf('retry') === 0) {
        retry = parseInt(line.replace(/retry:?\s*/, ''), 10);
        if (!isNaN(retry)) {
          this.interval = retry;
        }
      } else if (line.indexOf('data') === 0) {
        data.push(line.replace(/data:?\s*/, ''));
      } else if (line.indexOf('id:') === 0) {
        this.lastEventId = line.replace(/id:?\s*/, '');
      } else if (line.indexOf('id') === 0) {
        this.lastEventId = null;
      } else if (line === '') {
        if (data.length > 0) {
          const eventType = this.eventType || 'message'
          const event = {
            type: eventType,
            data: data.join("\n"),
            url: this.url,
            lastEventId: this.lastEventId,
          };

          this.dispatch(eventType, event);

          data = [];
          this.eventType = undefined;
        }
      }
    }
  }

  addEventListener(type, listener) {
    if (this.eventHandlers[type] === undefined) {
      this.eventHandlers[type] = [];
    }

    this.eventHandlers[type].push(listener);
  }

  removeEventListener(type, listener) {
    if (this.eventHandlers[type] !== undefined) {
      this.eventHandlers[type] = this.eventHandlers[type].filter((handler) => handler !== listener);
    }
  }

  removeAllEventListeners(type) {
    const availableTypes = Object.keys(this.eventHandlers);

    if (type === undefined) {
      for (const eventType of availableTypes) {
        this.eventHandlers[eventType] = [];
      }
    } else {
      if (!availableTypes.includes(type)) {
        throw Error(`[EventSource] '${type}' type is not supported event type.`);
      }

      this.eventHandlers[type] = [];
    }
  }

  dispatch(type, data) {
    const availableTypes = Object.keys(this.eventHandlers);

    if (!availableTypes.includes(type)) {
      return;
    }

    for (const handler of Object.values(this.eventHandlers[type])) {
      handler(data);
    }
  }

  close() {
    this.status = this.CLOSED;
    clearTimeout(this._pollTimer);
    if (this._xhr) {
      this._xhr.abort();
    }

    this.dispatch('close', { type: 'close' });
  }
}

export default EventSource;
