import React from 'react';
import { Link } from 'react-router';

export class Navbar extends React.Component {
  static get propTypes() {
    return {
      settingsActive: React.PropTypes.bool,
      currentScreenLink: React.PropTypes.string,
    };
  }

  render() {
    const settingsLink = this.props.settingsActive
                         ? this.props.currentScreenLink
                         : '/settings';
    const settingsClass = `icon ${this.props.settingsActive ? 'active' : ''}`;

    return (
      <header>
        <hgroup>
          <h1>Tensai</h1>
          <h2 className="subject">Subject</h2>
        </hgroup>
        <Link id="sync-settings" to="/settings#sync">
          <div id="sync-status" className="icon"></div>
        </Link>
        <Link to={settingsLink}>
          <div id="settings-menu" className={settingsClass}></div>
        </Link>
      </header>
    );
  }
}

export default Navbar;
