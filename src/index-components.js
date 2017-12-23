import ReactDOM from 'react-dom';
import React from 'react';

import 'main.scss'; // eslint-disable-line

import CancelableTextbox from './components/CancelableTextbox.jsx';
import SyncSettingsPanel from './components/SyncSettingsPanel.jsx';
import TabBlock from './components/TabBlock.jsx';

import SyncState from './sync-states';

ReactDOM.render(
  <CancelableTextbox
    value="CancelableTextbox"
    onChange={() => {
      console.log('CancelableTextbox: onChange');
    }}
    onFocus={() => {
      console.log('CancelableTextbox: onFocus');
    }}
  />,
  document.getElementById('cancelable-textbox-container')
);

(function renderTabs(selectedTab) {
  ReactDOM.render(
    <TabBlock className="extra-class" active={selectedTab}>
      <a
        id="lookup-tab"
        href="/lookup"
        aria-controls="lookup-page"
        className="-icon -lookup"
        onClick={evt => {
          renderTabs(0);
          evt.preventDefault();
        }}>
        Lookup
      </a>
      <a
        id="add-tab"
        href="/add"
        aria-controls="add-page"
        className="-icon -plus"
        onClick={evt => {
          renderTabs(1);
          evt.preventDefault();
        }}>
        Add card
      </a>
      <a
        id="review-tab"
        href="/review"
        aria-controls="review-page"
        className="-icon -review -badge"
        data-badge="10%"
        onClick={evt => {
          renderTabs(2);
          evt.preventDefault();
        }}>
        Review
      </a>
    </TabBlock>,
    document.getElementById('tab-block-container')
  );
})();

const stub = () => {};

ReactDOM.render(
  <SyncSettingsPanel
    syncState={SyncState.NOT_CONFIGURED}
    onSubmit={stub}
    onRetry={stub}
    onEdit={stub}
    onCancel={stub}
    onPause={stub}
    onResume={stub}
  />,
  document.getElementById('sync-notconfigured-container')
);

const server = {
  name: 'http://server.server.server/path'
};

ReactDOM.render(
  <SyncSettingsPanel
    syncState={SyncState.OK}
    server={server}
    lastSyncTime={new Date(Date.now() - 1 * 1000 * 60 * 60 * 24)}
    onSubmit={stub}
    onRetry={stub}
    onEdit={stub}
    onCancel={stub}
    onPause={stub}
    onResume={stub}
  />,
  document.getElementById('sync-uptodate-container')
);
