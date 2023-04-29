class EventSource {
  static ERROR = -1;
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  constructor(url, options = {}) {
    this.interval = options.pollingInterval || 5000;
    this.lastEventId = null;
    this.lastIndexProcessed = 0;
    this.eventType = undefined;
    this.status = EventSource.CONNECTING;
    this.method = options.method || 'GET';
    this.timeout = options.timeOut || 0;
    this.headers = options.headers || {};
    this.body = options.body || undefined;
    this.debug = options.debug || false;
    this.timeoutBeforeConnection = options.timeoutBeforeConnection ?? 500;

    this._xhr = null;
    this._pollTimer = null;
    this._eventHandlers = new Map();

    if (!url || (typeof url !== 'string' && typeof url.toString !== 'function')) {
      throw new SyntaxError('[EventSource] Invalid URL argument.');
    }

    if (typeof url.toString === 'function') {
      this.url = url.toString();
    } else {
      this.url = url;
    }

    this._pollAgain(this.timeoutBeforeConnection);
  }

  _pollAgain(time) {
    this._pollTimer = setTimeout(() => {
      this.open();
    }, time);
  }

  open() {
    try {
      this.lastIndexProcessed = 0;
      this.status = EventSource.CONNECTING;

      this._xhr = new XMLHttpRequest();
      this._xhr.open(this.method, this.url, true);

      if (this.headers) {
        for (const [key, value] of Object.entries(this.headers)) {
          this._xhr.setRequestHeader(key, value);
        }
      }

      this._xhr.setRequestHeader('Accept', 'text/event-stream');
      this._xhr.setRequestHeader('Cache-Control', 'no-cache');
      this._xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

      if (this.lastEventId !== null) {
        this._xhr.setRequestHeader('Last-Event-ID', this.lastEventId);
      }

      this._xhr.timeout = this.timeout;

      this._xhr.onreadystatechange = () => {
        const xhr = this._xhr;

        if (this.debug) {
          console.debug(
            `[EventSource][onreadystatechange] ReadyState: ${xhr.readyState}, status: ${xhr.status}`
          );
        }

        if (![XMLHttpRequest.DONE, XMLHttpRequest.LOADING].includes(xhr.readyState)) {
          return;
        }

        if (xhr.status >= 200 && xhr.status < 400) {
          if (this.status === EventSource.CONNECTING) {
            this.status = EventSource.OPEN;
            this.dispatch('open', { type: 'open' });
          }

          this._handleEvent(xhr.responseText || '');

          if (xhr.readyState === XMLHttpRequest.DONE) {
            if (this.debug) {
              console.debug(
                '[EventSource][onreadystatechange][DONE] Operation done. Reconnecting...'
              );
            }
            this._pollAgain(this.interval);
          }
        } else if (this.status !== EventSource.CLOSED) {
          if (this._xhr.status !== 0) {
            this.dispatch('error', {
              type: 'error',
              message: xhr.responseText,
              xhrStatus: xhr.status,
              xhrState: xhr.readyState,
            });
          }

          if ([XMLHttpRequest.DONE, XMLHttpRequest.UNSENT].includes(xhr.readyState)) {
            if (this.debug) {
              console.debug(
                '[EventSource][onreadystatechange][ERROR] Response status error. Reconnecting...'
              );
            }

            this._pollAgain(this.interval);
          }
        }
      };

      this._xhr.onerror = (e) => {
        this.status === EventSource.ERROR;

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
            this.dispatch('error', {
              type: 'timeout',
            });

            this.close();
          }
        }, this.timeout);
      }
    } catch (e) {
      this.status = EventSource.ERROR;
      this.dispatch('error', {
        type: 'exception',
        message: e.message,
        error: e,
      });
    }
  }

  _handleEvent(response) {
    const parts = response.substr(this.lastIndexProcessed).split('\n');
    this.lastIndexProcessed = response.lastIndexOf('\n\n') + 2;
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
    if (!this._eventHandlers.has(type)) {
      this._eventHandlers.set(type, new Set());
    }
    
    this._eventHandlers.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this._eventHandlers.get(type)?.delete(listener);
  }

  removeAllEventListeners(type) {
    if (type === undefined) {
      this._eventHandlers = new Map();
    } else {
      if (!this._eventHandlers.delete(type)) {
        throw Error(`[EventSource] '${type}' has no listeners attached.`);
      }
    }
  }

  dispatch(type, data) {
    const handlers = this._eventHandlers.get(type);

    if(handlers){
      handlers.forEach(handler => {
        handler(data);
      });
    }
  }

  close() {
    this.status = EventSource.CLOSED;
    clearTimeout(this._pollTimer);
    if (this._xhr) {
      this._xhr.abort();
    }

    this.dispatch('close', { type: 'close' });
  }
}

export default EventSource;
