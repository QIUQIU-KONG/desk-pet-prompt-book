import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  USER_DATA_DIRECTORY,
  attachExitContextMenu,
  configureStableUserDataPath,
  focusPrimaryWindow,
  setupSingleInstance
} = require('../src/electron/app-lifecycle.cjs');

test('configureStableUserDataPath fixes packaged and source data to the same AppData directory', () => {
  const calls = [];
  const appDataPath = path.join('C:', 'AppData', 'Roaming');
  const fakeApp = {
    getPath(name) {
      assert.equal(name, 'appData');
      return appDataPath;
    },
    setPath(name, value) {
      calls.push([name, value]);
    }
  };

  const result = configureStableUserDataPath(fakeApp);

  assert.equal(USER_DATA_DIRECTORY, 'desk-pet-prompt-book');
  assert.equal(result, path.join(appDataPath, USER_DATA_DIRECTORY));
  assert.deepEqual(calls, [['userData', result]]);
});

test('setupSingleInstance registers the second-launch callback after acquiring the lock', () => {
  const listeners = [];
  const callback = () => {};
  const fakeApp = {
    requestSingleInstanceLock: () => true,
    on(eventName, handler) {
      listeners.push([eventName, handler]);
    },
    quit() {
      throw new Error('quit must not be called after acquiring the lock');
    }
  };

  assert.equal(setupSingleInstance(fakeApp, callback), true);
  assert.deepEqual(listeners, [['second-instance', callback]]);
});

test('setupSingleInstance quits a rejected secondary process without registering listeners', () => {
  let quitCalls = 0;
  let listenerCalls = 0;
  const fakeApp = {
    requestSingleInstanceLock: () => false,
    on() {
      listenerCalls += 1;
    },
    quit() {
      quitCalls += 1;
    }
  };

  assert.equal(setupSingleInstance(fakeApp, () => {}), false);
  assert.equal(quitCalls, 1);
  assert.equal(listenerCalls, 0);
});

test('focusPrimaryWindow restores, shows, and focuses the existing window', () => {
  const calls = [];
  const fakeWindow = {
    isDestroyed: () => false,
    isMinimized: () => true,
    restore: () => calls.push('restore'),
    show: () => calls.push('show'),
    focus: () => calls.push('focus')
  };

  assert.equal(focusPrimaryWindow(fakeWindow), true);
  assert.deepEqual(calls, ['restore', 'show', 'focus']);
  assert.equal(focusPrimaryWindow(null), false);
  assert.equal(focusPrimaryWindow({ isDestroyed: () => true }), false);
});

test('attachExitContextMenu opens one native command and exits only after selection', () => {
  let contextMenuHandler;
  let menuTemplate;
  let popupOptions;
  let quitCalls = 0;
  const fakeWindow = {
    webContents: {
      on(eventName, handler) {
        assert.equal(eventName, 'context-menu');
        contextMenuHandler = handler;
      }
    }
  };
  const fakeMenu = {
    buildFromTemplate(template) {
      menuTemplate = template;
      return {
        popup(options) {
          popupOptions = options;
        }
      };
    }
  };
  const fakeApp = {
    quit() {
      quitCalls += 1;
    }
  };

  attachExitContextMenu(fakeWindow, fakeMenu, fakeApp);
  contextMenuHandler({}, {});

  assert.equal(quitCalls, 0);
  assert.equal(menuTemplate.length, 1);
  assert.equal(menuTemplate[0].label, '退出桌宠');
  assert.deepEqual(popupOptions, { window: fakeWindow });

  menuTemplate[0].click();
  assert.equal(quitCalls, 1);
});
