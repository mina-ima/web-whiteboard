import { Buffer } from 'buffer';

declare global {
  interface Window {
    global: any;
    Buffer: any;
    process: any;
  }
}

// Ensure global object exists
if (typeof window !== 'undefined') {
  window.global = window;
}

// Ensure Buffer exists globally
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
}

// Ensure process exists
if (typeof window !== 'undefined') {
  window.process = window.process || {} as any;
  window.process.env = window.process.env || {};
  window.process.version = window.process.version || '';
  if (!window.process.nextTick) {
    window.process.nextTick = function (fn: Function) {
      setTimeout(fn, 0);
    };
  }
}