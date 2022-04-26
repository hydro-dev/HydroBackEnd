import React from 'react';
import type { editor } from 'monaco-editor';
import { connect } from 'react-redux';
import { load } from 'vj/components/monaco/loader';
import Editor from 'vj/components/editor';
import { diffLines } from 'diff';
import yaml from 'js-yaml';
import type { ProblemConfigFile, TestCaseConfig } from 'hydrooj/src/interface';

const mapStateToProps = (state) => ({
  config: state.config,
});
const mapDispatchToProps = (dispatch) => ({
  handleUpdateCode: (code) => {
    dispatch({
      type: 'CONFIG_CODE_UPDATE',
      payload: code,
    });
  },
});

interface Props {
  config: object;
  handleUpdateCode: Function;
}

const configKey = [
  'type', 'subType', 'target', 'score', 'time',
  'memory', 'filename', 'checker_type', 'checker', 'interactor',
  'user_extra_files', 'judge_extra_files', 'detail', 'outputs', 'redirect',
  'cases', 'subtasks', 'langs',
];

const subtasksKey = [
  'time', 'memory', 'score', 'if', 'id',
  'type', 'cases',
];

const casesKey = ['time', 'memory', 'input', 'output'];

function configYamlFormat(config: ProblemConfigFile) {
  const formatConfig: ProblemConfigFile = {};
  configKey.forEach((key) => {
    if (config[key] !== undefined) {
      if (key === 'checker_type' && config.type !== 'default') return;
      if (key === 'checker'
        && (['default', 'strict'].includes(formatConfig.checker_type) || formatConfig.checker_type === undefined)) return;
      if (key === 'interactor' && config.type !== 'interactive') return;
      if (key === 'subtasks') {
        formatConfig[key] = [];
        config[key].forEach((subtask) => {
          const formatSubtask: object = {};
          subtasksKey.forEach((subtaskKey) => {
            if (subtask[subtaskKey] !== undefined) {
              formatSubtask[subtaskKey] = subtask[subtaskKey];
            }
          });
          formatConfig[key].push(formatSubtask);
        });
      } else if (key === 'cases') {
        formatConfig[key] = [];
        config[key].forEach((caseItem) => {
          const formatCase: TestCaseConfig = {
            time: 1000, memory: 256, input: '', output: '',
          };
          casesKey.forEach((caseKey) => {
            if (caseItem[caseKey] !== undefined) formatCase[caseKey] = caseItem[caseKey];
            else delete formatCase[caseKey];
          });
          formatConfig[key].push(formatCase);
        });
      } else formatConfig[key] = config[key];
    }
  });
  Object.keys(formatConfig).filter((i) => i.startsWith('__')).forEach((i) => delete formatConfig[i]);
  return formatConfig;
}

export default connect(mapStateToProps, mapDispatchToProps)(class MonacoEditor extends React.PureComponent<Props> {
  disposable = [];
  containerElement: HTMLElement;
  private __preventUpdate = false;
  private __preventFormat = false;

  editor: editor.IStandaloneCodeEditor;
  model: editor.ITextModel;
  vjEditor: Editor;

  async componentDidMount() {
    const { monaco } = await load(['yaml']);
    const uri = monaco.Uri.parse('hydro://problem/file/config.yaml');
    this.model = monaco.editor.createModel(yaml.dump(configYamlFormat(this.props.config)), 'yaml', uri);
    this.vjEditor = Editor.getOrConstruct($(this.containerElement), {
      language: 'yaml',
      model: this.model,
      onChange: (value: string) => {
        this.__preventUpdate = true;
        if (!this.__preventFormat) this.props.handleUpdateCode(value);
        this.__preventUpdate = false;
      },
    }) as Editor;
    this.editor = this.vjEditor.editor;
  }

  componentDidUpdate(prevProps) {
    if (this.__preventUpdate || !this.model) return;
    if (yaml.dump(prevProps.config) !== yaml.dump(this.props.config)) {
      this.__preventFormat = true;
      const curValue = this.model.getValue();
      const diff = diffLines(curValue, yaml.dump(configYamlFormat(this.props.config)));
      const ops = [];
      let cursor = 1;
      for (const line of diff) {
        if (line.added) {
          let range = this.model.getFullModelRange();
          range = range.setStartPosition(cursor, 0);
          range = range.setEndPosition(cursor, 0);
          ops.push({ range, text: line.value });
        } else if (line.removed) {
          let range = this.model.getFullModelRange();
          range = range.setStartPosition(cursor, 0);
          cursor += line.count;
          range = range.setEndPosition(cursor, 0);
          ops.push({ range, text: '' });
        } else cursor += line.count;
      }
      this.model.pushEditOperations([], ops, undefined);
      this.__preventFormat = false;
    }
  }

  componentWillUnmount() {
    if (this.vjEditor) this.vjEditor.destory();
    if (this.model) this.model.dispose();
    if (this.editor) this.editor.dispose();
    this.disposable.map((i) => i.dispose());
  }

  assignRef = (component) => {
    this.containerElement = component;
  };

  render() {
    return (
      <div
        ref={this.assignRef}
        style={{
          minHeight: '500px',
          height: '100%',
          width: '100%',
        }}
        className="ConfigMonacoEditor"
      >
      </div>
    );
  }
});
