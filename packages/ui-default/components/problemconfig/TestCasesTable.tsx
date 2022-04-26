import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import i18n from 'vj/utils/i18n';
import { isEqual } from 'lodash';
import { Tag, NumericInput } from '@blueprintjs/core';
import { parseTimeMS, parseMemoryMB } from '@hydrooj/utils/lib/common';
import type { SubtaskConfig } from 'hydrooj/src/interface';
import type { RootState } from './reducer/index';
import FileSelectAutoComplete from '../autocomplete/components/FileSelectAutoComplete';

const eq = (a: SubtaskConfig, b: SubtaskConfig) => isEqual(a, b);
const eqArr = (a: any[], b: any[]) => isEqual(a, b);

export function TestCaseEntry({ index, subindex }) {
  const testcase = useSelector((state: RootState) => state.config.subtasks[index].cases[subindex], eq);
  const Files = useSelector((state: RootState) => state.testdata, eqArr);
  const defaultTime = useSelector((state: RootState) => state.config.subtasks[index].time || state.config.time);
  const defaultMemory = useSelector((state: RootState) => state.config.subtasks[index].memory || state.config.memory);
  const dispatch = useDispatch();
  const dispatcher = (casesKey: string, valueSuffix = '') => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | number) => {
    let value = typeof ev !== 'object' ? ev : ev.currentTarget.value;
    if (value === 0) value = '';
    if (valueSuffix && value) value += valueSuffix;
    dispatch({
      type: 'CONFIG_SUBTASK_UPDATE',
      id: index,
      key: 'cases-edit',
      casesId: subindex,
      casesKey,
      value,
    });
  };
  return (
    <tr>
      <td>
        <NumericInput
          rightElement={<Tag minimal>ms</Tag>}
          value={testcase.time ? parseTimeMS(testcase.time).toString() : ''}
          placeholder={parseTimeMS(defaultTime || '1000ms').toString()}
          onValueChange={dispatcher('time', 'ms')}
          buttonPosition="none"
          fill
        />
      </td>
      <td>
        <NumericInput
          rightElement={<Tag minimal>MB</Tag>}
          value={testcase.memory ? parseMemoryMB(testcase.memory).toString() : ''}
          placeholder={parseMemoryMB(defaultMemory || '256m').toString()}
          onValueChange={dispatcher('memory', 'MB')}
          buttonPosition="none"
          fill
        />
      </td>
      {['input', 'output'].map((t) => (
        <td key={t}>
          <FileSelectAutoComplete
            width="100%"
            data={Files}
            selectedKeys={[testcase[t]]}
            onChange={dispatcher(t)}
          />
        </td>
      ))}
      <td className="col--operation">
        <a
          onClick={() => dispatch({
            type: 'CONFIG_SUBTASK_UPDATE', id: index, key: 'cases-delete', value: subindex,
          })}
        ><span className="icon icon-close"></span>
        </a>
      </td>
    </tr>
  );
}

export function CasesTable({ index }) {
  const len = useSelector((state: RootState) => state.config.subtasks[index].cases?.length);
  const dispatch = useDispatch();
  return (
    <table className="data-table">
      <thead style={{ display: 'none' }}>
        <tr>
          <th>{i18n('Time')}</th>
          <th>{i18n('Memory')}</th>
          <th>{i18n('Input')}</th>
          <th>{i18n('Output')}</th>
          <th className="col--operation">
            <a
              onClick={() => dispatch({
                type: 'CONFIG_SUBTASK_UPDATE',
                id: index,
                key: 'cases-add',
                value: { input: '', output: '' },
              })}
            ><span className="icon icon-add" />
            </a>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr className="thead">
          <td>{i18n('Time')}</td>
          <td>{i18n('Memory')}</td>
          <td>{i18n('Input')}</td>
          <td>{i18n('Output')}</td>
          <td className="col--operation">
            <a
              onClick={() => dispatch({
                type: 'CONFIG_SUBTASK_UPDATE',
                id: index,
                key: 'cases-add',
                value: { input: '', output: '' },
              })}
            ><span className="icon icon-add" />
            </a>
          </td>
        </tr>
        {[...Array(len).keys()].map((i) => <TestCaseEntry index={index} subindex={i} key={i} />)}
      </tbody>
    </table>
  );
}
