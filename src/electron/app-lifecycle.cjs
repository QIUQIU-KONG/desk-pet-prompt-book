const path = require('node:path');

const USER_DATA_DIRECTORY = 'desk-pet-prompt-book';

function configureStableUserDataPath(app) {
  const userDataPath = path.join(app.getPath('appData'), USER_DATA_DIRECTORY);
  app.setPath('userData', userDataPath);
  return userDataPath;
}

function setupSingleInstance(app, onSecondInstance) {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return false;
  }

  app.on('second-instance', onSecondInstance);
  return true;
}

function focusPrimaryWindow(window) {
  if (!window || window.isDestroyed()) {
    return false;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
  return true;
}

function attachExitContextMenu(window, Menu, app) {
  window.webContents.on('context-menu', () => {
    const menu = Menu.buildFromTemplate([
      {
        label: '退出桌宠',
        click: () => app.quit()
      }
    ]);

    menu.popup({ window });
  });
}

module.exports = {
  USER_DATA_DIRECTORY,
  attachExitContextMenu,
  configureStableUserDataPath,
  focusPrimaryWindow,
  setupSingleInstance
};
