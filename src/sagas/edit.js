import { call, fork, put, race, select, take, takeEvery }
       from 'redux-saga/effects';
import { delay } from 'redux-saga';
import { routeFromURL, routeFromPath, URLFromRoute, routesEqual }
       from '../router';
import * as editActions from '../actions/edit';
import * as routeActions from '../actions/route';
import EditState from '../edit-states';

const SAVE_DELAY = 2000;

// Selectors

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
const getActiveRecord = state => (state ? state.edit.forms.active : {});

// Sagas

export function* navigate(cardStore, action) {
  // Look for navigation actions that should load a card
  const route = action.url
                ? routeFromURL(action.url)
                : routeFromPath(action.path, action.search, action.fragment);
  if (route.screen !== 'edit-card') {
    return;
  }

  if (!route.card) {
    yield put(editActions.newCard());
    return;
  }

  yield put(editActions.loadCard(route.card));

  const activeRecord = yield select(getActiveRecord);
  const formId = activeRecord.formId;

  try {
    const card = yield call([ cardStore, 'getCard' ], route.card);
    yield put(editActions.finishLoadCard(formId, card));
  } catch (error) {
    console.error(`Failed to load card: ${error}`);
    yield put(editActions.failLoadCard(formId));
  }
}

function* save(cardStore, formId, card, options) {
  try {
    const [ index, route ] =
      [ yield select(getHistoryIndex),
        yield select(getCurrentRoute) ];
    const silent = options && options.silent;

    const savedCard = yield call([ cardStore, 'putCard' ], card);
    yield put(editActions.finishSaveCard(formId, savedCard));

    // If it is a new card, update the URL.
    //
    // However, there's a chance that the user has navigated to a new URL in
    // between when we started the save and now so check that's not the case
    // first.
    if (!card._id && !silent) {
      const [ currentIndex, currentRoute ] =
        [ yield select(getHistoryIndex),
          yield select(getCurrentRoute) ];
      if (currentIndex === index && routesEqual(currentRoute, route)) {
        const newUrl  = URLFromRoute({ screen: 'edit-card',
                                       card: savedCard._id });
        yield put(routeActions.silentlyUpdateUrl(newUrl));
      }
    }

    return savedCard._id;
  } catch (error) {
    console.error(`Failed to save: ${error}`);
    yield put(editActions.failSaveCard(formId, error));
    // Re-throw error since when saving synchronously we want to know about it
    throw error;
  }
}

function* autoSave(cardStore, formId, card) {
  // Debounce -- we allow this part of the task to be cancelled
  // eslint-disable-next-line no-unused-vars
  const { wait, cancel } = yield race({
    wait: call(delay, SAVE_DELAY),
    cancel: take('CANCEL_AUTO_SAVE'),
  });

  if (cancel) {
    return formId;
  }

  // The remaining steps should not be cancelled since otherwise we risk
  // writing the card twice with different IDs.
  try {
    return yield save(cardStore, formId, card);
  } catch (error) {
    // Nothing special to do here. We'll have already dispatched the appropriate
    // action and that's enough for auto-saving.
    return formId;
  }
}

export function* watchCardEdits(cardStore) {
  let autoSaveTask;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const action = yield take(
      [ 'EDIT_CARD', 'SAVE_EDIT_CARD', 'NAVIGATE', 'NAVIGATE_FROM_HISTORY' ]
    );

    const activeRecord = yield select(getActiveRecord);
    // In future we'll probably need to look through the different forms
    // to find the correct one, but for now this should hold.
    console.assert(!action.formId || activeRecord.formId === action.formId,
                   'Active record mismatch ' +
                   `${activeRecord.formId} vs ${action.formId}`);

    // Check if anything needs saving
    if (activeRecord.editState !== EditState.DIRTY) {
      if (typeof action.onSuccess === 'function') {
        yield call(action.onSuccess);
      }
      continue;
    }

    let id = action.formId || activeRecord.formId;
    // If there is an auto save in progress, cancel it.
    if (autoSaveTask) {
      if (autoSaveTask.isRunning()) {
        yield put({ type: 'CANCEL_AUTO_SAVE' });
      }
      // Get the possibly updated card ID.
      try {
        id = yield autoSaveTask.done;
      } catch (error) {
        // If the previous auto-save failed, just ignore it. It will have
        // dispatched a suitable error action.
      }
    }
    autoSaveTask = undefined;

    switch (action.type) {
      case 'EDIT_CARD':
        autoSaveTask = yield fork(autoSave, cardStore, id, activeRecord.card);
        break;

      case 'SAVE_EDIT_CARD':
        try {
          yield save(cardStore, id, activeRecord.card);
          if (typeof action.onSuccess === 'function') {
            yield call(action.onSuccess);
          }
        } catch (error) {
          // Don't do anything, but don't trigger the onSuccess action.
        }
        break;

      case 'NAVIGATE':
      case 'NAVIGATE_FROM_HISTORY':
        try {
          yield save(cardStore, id, activeRecord.card, { silent: true });
        } catch (error) {
          // Someone, somewhere, is listening for failed save actions, right?
          // Right?
        }
        break;

      default:
        console.log(`Unexpected action ${action.type}`);
        break;
    }
  }
}

function* editSagas(cardStore) {
  /* eslint-disable indent */
  yield* [ takeEvery([ 'NAVIGATE', 'NAVIGATE_FROM_HISTORY' ],
                     navigate, cardStore),
           watchCardEdits(cardStore) ];
  /* eslint-enable indent */
}

export default editSagas;
