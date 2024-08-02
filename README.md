# React Native EventSource (Server-Sent Events) 🚀

Your missing EventSource implementation for React Native! React-Native-SSE library supports TypeScript.

## 💿 Installation

We use XMLHttpRequest to establish and handle an SSE connection, so you don't need an additional native Android and iOS implementation. It's easy, just install it with your favorite package manager:

### Yarn

```bash
yarn add react-native-sse
```

### NPM

```bash
npm install --save react-native-sse
```

## 🎉 Usage

We are using Server-Sent Events as a convenient way of establishing and handling Mercure connections. It helps us keep data always up-to-date, synchronize data between devices, and improve real-time workflow. Here you have some usage examples:

### Import

```js
import EventSource from "react-native-sse";
```

### Connection and listeners

```js
import EventSource from "react-native-sse";

const es = new EventSource("https://your-sse-server.com/.well-known/mercure");

es.addEventListener("open", (event) => {
  console.log("Open SSE connection.");
});

es.addEventListener("message", (event) => {
  console.log("New message event:", event.data);
});

es.addEventListener("error", (event) => {
  if (event.type === "error") {
    console.error("Connection error:", event.message);
  } else if (event.type === "exception") {
    console.error("Error:", event.message, event.error);
  }
});

es.addEventListener("done", (event) => {
  console.log("Done SSE connection.");
});

es.addEventListener("close", (event) => {
  console.log("Close SSE connection.");
});
```

### Done vs Close

`done` events will fire when server closes the connection.
By default, the client will automatically reconnect when this happens.
You can disable reconnections by setting the `pollingInterval` option to `0`.
`close` events will fire when the connection is terminated by the client, using `.close()`.

### Headers and params

If you want to use Bearer token and/or topics, look at this example (TypeScript):

```typescript
import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import EventSource, { EventSourceListener } from "react-native-sse";
import "react-native-url-polyfill/auto"; // Use URL polyfill in React Native

interface Book {
  id: number;
  title: string;
  isbn: string;
}

const token = "[my-hub-token]";

const BookList: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    const url = new URL("https://your-sse-server.com/.well-known/mercure");
    url.searchParams.append("topic", "/book/{bookId}");

    const es = new EventSource(url, {
      headers: {
        Authorization: {
          toString: function () {
            return "Bearer " + token;
          },
        },
      },
    });

    const listener: EventSourceListener = (event) => {
      if (event.type === "open") {
        console.log("Open SSE connection.");
      } else if (event.type === "message") {
        const book = JSON.parse(event.data) as Book;

        setBooks((prevBooks) => [...prevBooks, book]);

        console.log(`Received book ${book.title}, ISBN: ${book.isbn}`);
      } else if (event.type === "error") {
        console.error("Connection error:", event.message);
      } else if (event.type === "exception") {
        console.error("Error:", event.message, event.error);
      }
    };

    es.addEventListener("open", listener);
    es.addEventListener("message", listener);
    es.addEventListener("error", listener);

    return () => {
      es.removeAllEventListeners();
      es.close();
    };
  }, []);

  return (
    <View>
      {books.map((book) => (
        <View key={`book-${book.id}`}>
          <Text>{book.title}</Text>
          <Text>ISBN: {book.isbn}</Text>
        </View>
      ))}
    </View>
  );
};

export default BookList;
```

### Usage with React Redux

Since the listener is a closure it has access only to the component values from the first render. Each subsequent render
has no effect on already defined listeners.

If you use Redux you can get the actual value directly from the store instance.

```typescript
// full example: https://snack.expo.dev/@quiknull/react-native-sse-redux-example
type CustomEvents = "ping";

const Example: React.FC = () => {
    const name = useSelector((state: RootState) => state.user.name);

    const pingHandler: EventSourceListener<CustomEvents, 'ping'> = useCallback(
        (event) => {
            // In Event Source Listeners in connection with redux
            // you should read state directly from store object.
            console.log("User name from component selector: ", name); // bad
            console.log("User name directly from store: ", store.getState().user.name); // good
        },
        []
    );

    useEffect(() => {
        const token = "myToken";
        const url = new URL("https://demo.mercure.rocks/.well-known/mercure");
        url.searchParams.append(
            "topic",
            "https://example.com/my-private-topic"
        );

        const es = new EventSource<CustomEvents>(url, {
            headers: {
                Authorization: {
                    toString: function () {
                        return "Bearer " + token;
                    }
                }
            }
        });

        es.addEventListener("ping", pingHandler);
    }, []);
};
```

## 📖 Configuration

```typescript
new EventSource(url: string | URL, options?: EventSourceOptions);
```

### Options

```typescript
const options: EventSourceOptions = {
  method: 'GET', // Request method. Default: GET
  timeout: 0, // Time (ms) after which the connection will expire without any activity. Default: 0 (no timeout)
  timeoutBeforeConnection: 500, // Time (ms) to wait before initial connection is made. Default: 500
  withCredentials: false, // Include credentials in cross-site Access-Control requests. Default: false
  headers: {}, // Your request headers. Default: {}
  body: undefined, // Your request body sent on connection. Default: undefined
  debug: false, // Show console.debug messages for debugging purpose. Default: false
  pollingInterval: 5000, // Time (ms) between reconnections. If set to 0, reconnections will be disabled. Default: 5000
  lineEndingCharacter: null // Character(s) used to represent line endings in received data. Common values: '\n' for LF (Unix/Linux), '\r\n' for CRLF (Windows), '\r' for CR (older Mac). Default: null (Automatically detect from event)
}
```

## 🚀 Advanced usage with TypeScript

Using EventSource you can handle custom events invoked by the server:

```typescript
import EventSource, { EventSourceListener, EventSourceEvent } from "react-native-sse";

type MyCustomEvents = "ping" | "clientConnected" | "clientDisconnected";

const es = new EventSource<MyCustomEvents>(
  "https://your-sse-server.com/.well-known/hub"
);

es.addEventListener("open", (event) => {
  console.log("Open SSE connection.");
});

es.addEventListener("ping", (event) => {
  console.log("Received ping with data:", event.data);
});

es.addEventListener("clientConnected", (event) => {
  console.log("Client connected:", event.data);
});

es.addEventListener("clientDisconnected", (event) => {
  console.log("Client disconnected:", event.data);
});
```

Using one listener for all events:

```typescript
import EventSource, { EventSourceListener } from "react-native-sse";

type MyCustomEvents = "ping" | "clientConnected" | "clientDisconnected";

const es = new EventSource<MyCustomEvents>(
  "https://your-sse-server.com/.well-known/hub"
);

const listener: EventSourceListener<MyCustomEvents> = (event) => {
  if (event.type === 'open') {
    // connection opened
  } else if (event.type === 'message') {
    // ...
  } else if (event.type === 'ping') {
    // ...
  }
}
es.addEventListener('open', listener);
es.addEventListener('message', listener);
es.addEventListener('ping', listener);
```

Using generic type for one event:

```typescript
import EventSource, { EventSourceListener, EventSourceEvent } from "react-native-sse";

type MyCustomEvents = "ping" | "clientConnected" | "clientDisconnected";

const es = new EventSource<MyCustomEvents>(
  "https://your-sse-server.com/.well-known/hub"
);

const pingListener: EventSourceListener<MyCustomEvents, 'ping'> = (event) => {
  // ...
}
// or
const pingListener = (event: EventSourceEvent<'ping', MyCustomEvents>) => {
  // ...
}

es.addEventListener('ping', pingListener);
```

`MyCustomEvents` in `EventSourceEvent` is optional, but it's recommended to use it in order to have better type checking.

## 🚀 Usage with ChatGPT

If you want to use ChatGPT with React Native, you can use the following example:

```typescript
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import EventSource from "react-native-sse";

const OpenAIToken = '[Your OpenAI token]';

export default function App() {
  const [text, setText] = useState<string>("Loading...");

  useEffect(() => {
    const es = new EventSource(
      "https://api.openai.com/v1/chat/completions",
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OpenAIToken}`,
        },
        method: "POST",
        // Remember to read the OpenAI API documentation to set the correct body
        body: JSON.stringify({
          model: "gpt-3.5-turbo-0125",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant.",
            },
            {
              role: "user",
              content: "What is the meaning of life?",
            },
          ],
          max_tokens: 600,
          n: 1,
          temperature: 0.7,
          stream: true,
        }),
        pollingInterval: 0, // Remember to set pollingInterval to 0 to disable reconnections
      }
    );

    es.addEventListener("open", () => {
      setText("");
    });

    es.addEventListener("message", (event) => {
      if (event.data !== "[DONE]") {
        const data = JSON.parse(event.data);

        if (data.choices[0].delta.content !== undefined) {
          setText((text) => text + data.choices[0].delta.content);
        }
      }
    });

    return () => {
      es.removeAllEventListeners();
      es.close();
    };
  }, []);

  return (
    <View>
      <Text>{text}</Text>
    </View>
  );
}
```


---

Custom events always emit result with following interface:

```typescript
export interface CustomEvent<E extends string> {
  type: E;
  data: string | null;
  lastEventId: string | null;
  url: string;
}
```

## 👏 Contribution

If you see our library is not working properly, feel free to open an issue or create a pull request with your fixes.

## 📄 License

```
The MIT License

Copyright (c) 2021 Binary Minds

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
