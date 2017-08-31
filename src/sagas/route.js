import { takeEvery, call, put, race, select, take } from 'redux-saga/effects';
import { routeFromURL, routesEqual } from '../router';
import { beforeEditScreenChange } from './edit';
import * as routeActions from '../actions/route';

// Selectors

const getRoute = state => (state ? state.route || {} : {});
const getHistoryIndex = state => (
  state.route && typeof state.route.index === 'number' ? state.route.index : -1
);
const getCurrentRoute = state => {
  const index = getHistoryIndex(state);
  if (index < 0 ||
      !Array.isArray(state.route.history) ||
      index >= state.route.history.length) {
    return {};
  }
  return state.route.history[index];
};

// Sagas

export function* followLink(action) {
  const routeState = yield select(getRoute);
  let navigateRoute;

  // First, unless the direction is forwards, if the route matches the current
  // route ignore the navigation altogether.
  //
  // We need to allow this in the forwards direction since we can be on the new
  // card screen, and, before saving the card, click the 'Add card' button which
  // has the same URL as the current screen. If that happens we should run the
  // beforeScreenChange action which will update the current URL before we
  // navigate forwards.
  if ((action.direction === 'backwards' || action.direction === 'replace') &&
      typeof routeState.index === 'number' &&
      Array.isArray(routeState.history) &&
      routeState.index >= 0 &&
      routeState.index < routeState.history.length) {
    const currentRoute = routeState.history[routeState.index];
    navigateRoute = routeFromURL(action.url || '/');
    if (routesEqual(currentRoute, navigateRoute)) {
      return;
    }
  }

  // If the direction is backwards, check if the previous item in the history
  // matches the item we're trying to navigate. If it does, just call
  // history.back() and let the popstatechange handler take care of updating
  // state.
  if (action.direction === 'backwards' &&
      typeof routeState.index === 'number' &&
      Array.isArray(routeState.history) &&
      routeState.index >= 1 &&
      routeState.index < routeState.history.length) {
    const previousRoute = routeState.history[routeState.index - 1];
    navigateRoute = navigateRoute || routeFromURL(action.url || '/');
    if (routesEqual(previousRoute, navigateRoute)) {
      const screenChangeResult = yield call(beforeScreenChange);
      if (screenChangeResult) {
        yield call([ history, 'back' ]);
      }
      return;
    }
  }

  // Try to run the before change actions and if they fail, don't go ahead with
  // the navigation.
  const screenChangeResult = yield call(beforeScreenChange);
  if (!screenChangeResult) {
    return;
  }

  // Otherwise use pushState / replaceState() and dispatch the relevant action.
  if (action.direction === 'replace' &&
      typeof routeState.index === 'number' &&
      routeState.index >= 0) {
    yield call([ history, 'replaceState' ], { index: routeState.index }, '',
               action.url);
    yield put(routeActions.navigate({ url: action.url, replace: true }));
  } else {
    const index = typeof routeState.index === 'number'
                  ? routeState.index + 1
                  : 0;
    yield call([ history, 'pushState' ], { index }, '', action.url);
    yield put(routeActions.navigate({ url: action.url }));
  }
}

export function* beforeScreenChange() {
  const currentRoute = yield select(getCurrentRoute);

  if (currentRoute.screen === 'edit-card') {
    // eslint-disable-next-line no-unused-vars
    const { beforeChangeResult, navigate } = yield race({
      beforeChangeResult: call(beforeEditScreenChange),
      navigate: take('NAVIGATE'),
    });

    if (navigate) {
      return false;
    }
    return beforeChangeResult;
  }

  return true;
}

export function* updateUrl(action) {
  const routeState = yield select(getRoute);

  if (typeof routeState.index === 'number' &&
      routeState.index >= 0) {
    yield call([ history, 'replaceState' ],
               { index: routeState.index },
               '',
               action.url);
  }
}

function* routeSagas() {
  /* eslint-disable indent */
  yield* [ takeEvery('FOLLOW_LINK', followLink),
           takeEvery('BEFORE_SCREEN_CHANGE', beforeScreenChange),
           takeEvery('UPDATE_URL', updateUrl) ];
  /* eslint-enable indent */
}

export default routeSagas;
