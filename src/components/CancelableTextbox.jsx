import React from 'react';

export class CancelableTextbox extends React.Component {
  static get propTypes() {
    return {
      value: React.PropTypes.string,
      onChange: React.PropTypes.func,
    };
  }

  constructor(props) {
    super(props);

    this.state = { value: '' };
    this.handleChange = this.handleChange.bind(this);
    this.handleClear  = this.handleClear.bind(this);
  }

  componentWillMount() {
    this.setState({ value: this.props.value || '' });
  }

  componentWillReceiveProps(nextProps) {
    this.setState({ value: nextProps.value  || '' });
  }

  handleChange(e) {
    this.setState({ value: e.target.value });
    if (this.props.onChange) {
      this.props.onChange(e.target.value);
    }
  }

  handleClear() {
    this.setState({ value: '' });
    if (this.props.onChange) {
      this.props.onChange('');
    }
  }

  render() {
    const hidden = !this.state.value.length;

    return (
      <div className="cancelable-textbox-group">
        <input {...this.props}
          value={this.state.value}
          onChange={this.handleChange} />
        <button type="reset"
          className="cancelable-textbox-cancel"
          aria-hidden={hidden}
          onClick={this.handleClear}><span>Clear</span></button>
      </div>
    );
  }
}

export default CancelableTextbox;