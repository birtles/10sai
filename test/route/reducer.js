/* global describe, it */
/* eslint arrow-body-style: [ "off" ] */

import { assert } from 'chai';
import subject from '../../src/route/reducer';
import * as actions from '../../src/route/actions';

// We'd like to make this test independent of the router in use but rather than
// introduce complexity to make the router used by the reducer pluggable, we
// just define a few standard URLs/paths with corresponding routes here.
const urlA = '/';
const pathA = { path: '/', search: '', fragment: '' };
const routeA = { screen: '' };

const urlB = '/?abc=123';
const pathB = { path: '/', search: '?abc=123', fragment: '' };
const routeB = { screen: '', search: { abc: '123' } };

const urlC = '/#hash'; // eslint-disable-line no-unused-vars
// eslint-disable-next-line no-unused-vars
const pathC = { path: '/', search: '', fragment: '#hash' };
const routeC = { screen: '', fragment: 'hash' };

const urlD = '/?abc=123#hash'; // eslint-disable-line no-unused-vars
const pathD = { path: '/', search: '?abc=123', fragment: '#hash' };
const routeD = { screen: '', search: { abc: '123' }, fragment: 'hash' };

describe('reducer:route', () => {
  it('updates the current route on an initial NAVIGATE', () => {
    const action = actions.navigate(pathA);

    const updatedState = subject(undefined, action);

    assert.deepEqual(updatedState, { history: [routeA], index: 0 });
  });

  it('updates the current route on an initial NAVIGATE given a URL', () => {
    const action = actions.navigate({ url: urlA });

    const updatedState = subject(undefined, action);

    assert.deepEqual(updatedState, { history: [routeA], index: 0 });
  });

  it('updates the current route on an initial NAVIGATE given a (non-empty) URL', () => {
    const action = actions.navigate({ url: urlB });

    const updatedState = subject(undefined, action);

    assert.deepEqual(updatedState, { history: [routeB], index: 0 });
  });

  it('updates the current route on a initial NAVIGATE even if replace is true', () => {
    const action = actions.navigate({ replace: true, ...pathA });

    const updatedState = subject(undefined, action);

    assert.deepEqual(updatedState, { history: [routeA], index: 0 });
  });

  it('appends the route on a subsequent NAVIGATE when replace is missing', () => {
    const initialState = { history: [routeA], index: 0 };
    const action = actions.navigate(pathB);

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState, { history: [routeA, routeB], index: 1 });
  });

  it('appends the route on a subsequent NAVIGATE when replace is false', () => {
    const initialState = { history: [routeA], index: 0 };
    const action = actions.navigate({ replace: false, ...pathB });

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState, { history: [routeA, routeB], index: 1 });
  });

  it('updates the route on a subsequent NAVIGATE when replace is true', () => {
    const initialState = { history: [routeA], index: 0 };
    const action = actions.navigate({ replace: true, ...pathB });

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState, { history: [routeB], index: 0 });
  });

  it('truncates the history when NAVIGATE-ing mid-history', () => {
    const initialState = { history: [routeA, routeB, routeC], index: 1 };
    const action = actions.navigate(pathD);

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState, {
      history: [routeA, routeB, routeD],
      index: 2,
    });
  });

  it(
    'does NOT truncate the history when NAVIGATE-ing mid-history when replace' +
      ' is true',
    () => {
      const initialState = { history: [routeA, routeB, routeC], index: 1 };
      const action = actions.navigate({ replace: true, ...pathD });

      const updatedState = subject(initialState, action);

      assert.deepEqual(updatedState, {
        history: [routeA, routeD, routeC],
        index: 1,
      });
    }
  );

  it(
    'updates the index on NAVIGATE (source:history) when index is previous' +
      ' item',
    () => {
      const initialState = { history: [routeA, routeB, routeC], index: 2 };
      const action = actions.navigate({
        index: 1,
        source: 'history',
        ...pathB,
      });

      const updatedState = subject(initialState, action);

      assert.deepEqual(updatedState, {
        history: [routeA, routeB, routeC],
        index: 1,
      });
    }
  );

  it(
    'updates the index on NAVIGATE (source:history) when index is a few steps' +
      ' back',
    () => {
      const initialState = {
        history: [routeA, routeB, routeC, routeD],
        index: 3,
      };
      const action = actions.navigate({
        index: 1,
        source: 'history',
        ...pathB,
      });

      const updatedState = subject(initialState, action);

      assert.deepEqual(updatedState, {
        history: [routeA, routeB, routeC, routeD],
        index: 1,
      });
    }
  );

  it('does nothing on NAVIGATE (source:history) when index is current item', () => {
    const initialState = { history: [routeA, routeB, routeC], index: 1 };
    const action = actions.navigate({
      index: 1,
      source: 'history',
      ...pathB,
    });

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState, {
      history: [routeA, routeB, routeC],
      index: 1,
    });
  });

  it('updates the index on NAVIGATE (source:history) when index is zero', () => {
    const initialState = { history: [routeA, routeB, routeC], index: 2 };
    const action = actions.navigate({
      index: 0,
      source: 'history',
      ...pathA,
    });

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState, {
      history: [routeA, routeB, routeC],
      index: 0,
    });
  });

  it('does nothing on NAVIGATE (source:history) when index is null', () => {
    const initialState = { history: [routeA, routeB, routeC], index: 2 };
    const action = actions.navigate({
      index: null,
      source: 'history',
      ...pathA,
    });

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState, {
      history: [routeA, routeB, routeC],
      index: 2,
    });
  });

  it('does nothing on NAVIGATE (source:history) when index is missing', () => {
    const initialState = { history: [routeA, routeB, routeC], index: 2 };
    const action = actions.navigate({ source: 'history', ...pathB });

    const updatedState = subject(initialState, action);

    assert.deepEqual(updatedState, {
      history: [routeA, routeB, routeC],
      index: 2,
    });
  });

  it(
    'updates the index on NAVIGATE (source:history) when index is future' +
      ' item',
    () => {
      const initialState = { history: [routeA, routeB, routeC], index: 0 };
      const action = actions.navigate({
        source: 'history',
        index: 2,
        ...pathC,
      });

      const updatedState = subject(initialState, action);

      assert.deepEqual(updatedState, {
        history: [routeA, routeB, routeC],
        index: 2,
      });
    }
  );

  it(
    'pushes to history on NAVIGATE (source:history) when index is beyond' +
      ' history bounds',
    () => {
      const initialState = { history: [routeA, routeB, routeC], index: 2 };
      const action = actions.navigate({
        source: 'history',
        index: 4,
        ...pathD,
      });

      const updatedState = subject(initialState, action);

      assert.deepEqual(updatedState, {
        history: [routeA, routeB, routeC, routeD],
        index: 3,
      });
    }
  );

  it(
    'updates the history item on NAVIGATE (source:history) when passed route' +
      ' differs',
    () => {
      const initialState = { history: [routeA, routeB, routeC], index: 2 };
      const action = actions.navigate({
        source: 'history',
        index: 1,
        ...pathA,
      });

      const updatedState = subject(initialState, action);

      assert.deepEqual(updatedState, {
        history: [routeA, routeA, routeC],
        index: 1,
      });
    }
  );
});
