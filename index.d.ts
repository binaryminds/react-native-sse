export type EventType = 'open' | 'message' | 'error' | 'close';

export interface BaseEvent {
  type: string;
}

export interface MessageEvent {
  type: 'message';
  data: string | null;
  lastEventId: string | null;
  url: string;
}

export interface OpenEvent {
  type: 'open';
}

export interface CloseEvent {
  type: 'close';
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  xhrState: number;
  xhrStatus: number;
}

export interface CustomEvent<E extends string> {
  type: E;
  data: string | null;
}

export interface ExceptionEvent {
  type: 'exception';
  message: string;
  error: Error;
}

export interface EventSourceOptions {
  method?: string;
  timeout?: number;
  headers?: Record<string, any>;
  body?: any;
  debug?: boolean;
  pollingInterval?: number;
}

export type EventSourceEvent = MessageEvent | OpenEvent | CloseEvent | ErrorEvent | ExceptionEvent;

export type EventSourceListener<E extends string = never> = (
  event: CustomEvent<E> | EventSourceEvent
) => void;

declare class EventSource<E extends string = never> {
  constructor(url: URL | string, options?: EventSourceOptions);
  open(): void;
  close(): void;
  addEventListener(type: E | EventType, listener: EventSourceListener<E>): void;
  removeEventListener(type: E | EventType, listener: EventSourceListener<E>): void;
  removeAllEventListeners(type?: E | EventType): void;
  dispatch(type: E | EventType, data: E | EventSourceEvent): void;
}

export default EventSource;
