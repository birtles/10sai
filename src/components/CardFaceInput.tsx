import React from 'react';
import PropTypes from 'prop-types';
import { Change, Value } from 'slate';
import { Editor, Plugin, RenderMarkProps } from 'slate-react';
import PlainText from 'slate-plain-serializer';

interface Props {
  value?: string;
  className?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onSelectRange?: () => void;
}

interface State {
  editorState: Value;
  hasFocus: boolean;
}

export class CardFaceInput extends React.PureComponent<Props, State> {
  state: State;
  editor?: Editor;
  focusHandler: Plugin;
  plugins: Array<Plugin>;
  containerRef: React.RefObject<HTMLDivElement>;

  static get propTypes() {
    return {
      value: PropTypes.string,
      className: PropTypes.string,
      placeholder: PropTypes.string,
      onChange: PropTypes.func,
      onBlur: PropTypes.func,
    };
  }

  constructor(props: Props) {
    super(props);

    this.containerRef = React.createRef<HTMLDivElement>();

    this.state = {
      editorState: PlainText.deserialize(props.value || ''),
      hasFocus: false,
    };
    this.handleChange = this.handleChange.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleContainerFocus = this.handleContainerFocus.bind(this);

    this.focusHandler = {
      onFocus: () => {
        this.setState({ hasFocus: true });
      },
      onBlur: () => {
        this.setState({ hasFocus: false });
        if (this.props.onBlur) {
          this.props.onBlur();
        }
      },
    };
    this.plugins = [this.focusHandler];
  }

  componentWillMount() {
    if (this.props.value) {
      this.updateValue(this.props.value);
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.value !== nextProps.value) {
      this.updateValue(nextProps.value);
    }
  }

  updateValue(value?: string) {
    // Setting editorState can reset the selection so we should avoid doing it
    // when the content hasn't changed (since it can interrupt typing).
    const currentValue = PlainText.serialize(this.state.editorState);
    if (currentValue === value) {
      return;
    }

    const change = this.state.editorState
      .change()
      .selectAll()
      .delete()
      .insertText(value || '');

    this.setState({ editorState: change.value });
  }

  handleChange(change: Change) {
    if (
      change.value.selection !== this.state.editorState.selection &&
      !change.value.selection.isCollapsed &&
      this.props.onSelectRange
    ) {
      this.props.onSelectRange();
    }

    // We defer calling |onChange| until the state is actually updated so that
    // if that triggers a call to updateValue we can successfully recognize it
    // as a redundant change and avoid re-setting the editor state.
    this.setState((prevState, props) => {
      if (props.onChange) {
        const valueAsString = PlainText.serialize(change.value);
        if (valueAsString !== this.props.value) {
          props.onChange(valueAsString);
        }
      }

      return { editorState: change.value };
    });
  }

  handleKeyDown(event: Event, change: Change) {
    if (!(event as KeyboardEvent).ctrlKey) {
      return;
    }

    if ((event as KeyboardEvent).key === 'b') {
      event.preventDefault();
      return change.addMark('bold');
    }
  }

  handleContainerFocus() {
    if (this.state.hasFocus) {
      return;
    }

    this.focus();
  }

  focus() {
    if (this.editor) {
      this.editor.focus();
    }
    this.setState({ hasFocus: true });
  }

  get element(): HTMLElement | null {
    return this.containerRef.current;
  }

  collapseSelection() {
    const { editorState } = this.state;
    if (editorState.selection.isCollapsed) {
      return;
    }
    const change = editorState.change().collapseToAnchor();
    this.setState({ editorState: change.value });
  }

  toggleMark(type: 'bold') {
    const { editorState } = this.state;
    const change = editorState.change().toggleMark(type);
    this.setState({ editorState: change.value });
  }

  render() {
    const classes = [this.props.className, 'cardface-input'];

    return (
      <div
        className={classes.join(' ')}
        onClick={this.handleContainerFocus}
        ref={this.containerRef}
      >
        <Editor
          value={this.state.editorState}
          plugins={this.plugins}
          onChange={this.handleChange}
          onKeyDown={this.handleKeyDown}
          renderMark={renderMark}
          placeholder={this.props.placeholder}
          ref={editor => {
            this.editor = editor || undefined;
          }}
        />
      </div>
    );
  }
}

function renderMark(props: RenderMarkProps) {
  switch (props.mark.type) {
    case 'bold':
      return <BoldMark {...props} />;
  }
}

function BoldMark(props: RenderMarkProps) {
  return <strong>{props.children}</strong>;
}

export default CardFaceInput;
