import { sync as subject } from './sync';
import { queryAvailableCards, updateReviewCard } from './actions';
import { AvailableCardWatcher } from './available-card-watcher';
import { ReviewState } from './reducer';
import { reducer } from '../reducer';
import { ReviewAction } from './actions';
import { getReviewSummary } from './selectors';
import { ReviewPhase } from './review-phase';
import { Card, Review } from '../model';
import { CardChange } from '../store/CardStore';
import { DataStore } from '../store/DataStore';
import { Store } from 'redux';

jest.useFakeTimers();

type ChangeCallback = (change: any) => void;

class MockDataStore {
  cbs: {
    [type: string]: ChangeCallback[];
  };
  changes: EventEmitter;

  constructor() {
    this.cbs = {};
    this.changes = {
      on: (type: string, cb: ChangeCallback) => {
        if (this.cbs[type]) {
          this.cbs[type].push(cb);
        } else {
          this.cbs[type] = [cb];
        }
      },
    } as EventEmitter;
  }

  __triggerChange(type: string, change: CardChange | Review | null) {
    if (!this.cbs[type]) {
      return;
    }

    for (const cb of this.cbs[type]) {
      cb(change);
    }
  }

  async getReview() {
    return null;
  }
}

// This is the simplified view of the State we use here.
interface State {
  screen: string;
  review: ReviewState;
}

const initialState = reducer(undefined, { type: 'NONE' } as any);

class MockStore {
  cb?: () => void;
  state: State;
  actions: Array<ReviewAction>;

  constructor() {
    const { history } = initialState.route;
    const screen = history.length ? history[history.length - 1].screen : '';
    this.state = {
      screen,
      review: initialState.review,
    };
    this.actions = [];
  }

  subscribe(cb: () => void) {
    this.cb = cb;
  }

  dispatch(action: ReviewAction) {
    this.actions.push(action);
  }

  getState() {
    return this.state;
  }

  __update(newState: State) {
    this.state = newState;

    if (this.cb) {
      this.cb();
    }
  }
}

// Mock selectors from other modules we depend on
jest.mock('../route/selectors', () => ({
  getScreen: (state: State) => state.screen,
}));

describe('review:sync', () => {
  let mockDataStore: MockDataStore;
  let dataStore: DataStore;

  let mockStore: MockStore;
  let store: Store;

  let availableCardWatcher: AvailableCardWatcher;

  beforeEach(() => {
    mockDataStore = new MockDataStore();
    dataStore = (mockDataStore as unknown) as DataStore;

    mockStore = new MockStore();
    store = (mockStore as unknown) as Store;

    availableCardWatcher = new AvailableCardWatcher({ dataStore });

    // I couldn't work out how to get jest.MockImplementation to work for
    // this and ultimately I figured it's not worth the time.
    (setTimeout as any).mockClear();
    (clearTimeout as any).mockClear();
  });

  describe('available cards', () => {
    it('triggers an update immediately when cards are needed and there are none', () => {
      subject({ dataStore, store, availableCardWatcher });
      mockStore.__update({
        screen: 'review',
        review: initialState.review,
      });

      expect(mockStore.actions).toEqual([queryAvailableCards()]);
    });

    it('triggers an update immediately when cards are newly-needed due to a state change, even if there are some', () => {
      subject({ dataStore, store, availableCardWatcher });
      mockStore.__update({
        screen: 'review',
        review: {
          ...initialState.review,
          availableCards: { newCards: 2, overdueCards: 3 },
        },
      });

      expect(mockStore.actions).toEqual([queryAvailableCards()]);
    });

    it('does NOT trigger an update when cards are already being loaded', () => {
      subject({ dataStore, store, availableCardWatcher });
      mockStore.__update({
        screen: 'review',
        review: {
          ...initialState.review,
          loadingAvailableCards: true,
        },
      });

      expect(mockStore.actions).toEqual([]);
    });

    it('does NOT trigger an update when the progress is being saved', () => {
      subject({ dataStore, store, availableCardWatcher });
      mockStore.__update({
        screen: 'review',
        review: {
          ...initialState.review,
          savingProgress: true,
        },
      });

      expect(mockStore.actions).toEqual([]);
    });

    it('does NOT trigger an update when a card is added when not in an appropriate state', () => {
      subject({ dataStore, store, availableCardWatcher });
      mockStore.__update({
        screen: 'home',
        review: initialState.review,
      });
      expect(mockStore.actions).toEqual([]);
      expect(setTimeout).toHaveBeenCalledTimes(0);

      mockDataStore.__triggerChange('card', {
        card: { progress: { due: new Date() } } as Card,
      });

      expect(mockStore.actions).toEqual([]);
    });
  });

  describe('review cards', () => {
    it('triggers an update when the current card is updated', () => {
      subject({ dataStore, store, availableCardWatcher });

      const card: Card = {
        id: 'abc',
        front: 'Question',
        back: 'Answer',
        progress: {
          due: new Date(),
        },
      } as Card;
      mockStore.__update({
        screen: 'review',
        review: {
          ...initialState.review,
          currentCard: card,
        },
      });

      const updatedCard: Card = {
        ...card,
        front: 'Updated question',
      };
      mockDataStore.__triggerChange('card', { card: updatedCard });

      expect(mockStore.actions).toContainEqual(updateReviewCard(updatedCard));
    });

    it('triggers an update when an unreviewed card is updated', () => {
      subject({ dataStore, store, availableCardWatcher });

      const card = {
        id: 'abc',
        front: 'Question',
        back: 'Answer',
        progress: {
          due: new Date(),
        },
      } as Card;
      mockStore.__update({
        screen: 'review',
        review: {
          ...initialState.review,
          heap: [card],
        },
      });

      const updatedCard = {
        ...card,
        front: 'Updated question',
      };
      mockDataStore.__triggerChange('card', { card: updatedCard });

      expect(mockStore.actions).toContainEqual(updateReviewCard(updatedCard));
    });

    it('triggers an update when a failed card is updated', () => {
      subject({ dataStore, store, availableCardWatcher });

      const card = {
        id: 'abc',
        front: 'Question',
        back: 'Answer',
        progress: {
          due: new Date(),
        },
      } as Card;
      mockStore.__update({
        screen: 'review',
        review: {
          ...initialState.review,
          failed: [card],
        },
      });

      const updatedCard = {
        ...card,
        front: 'Updated question',
      };
      mockDataStore.__triggerChange('card', { card: updatedCard });

      expect(mockStore.actions).toContainEqual(updateReviewCard(updatedCard));
    });

    it('triggers an update when the current card is deleted', () => {
      subject({ dataStore, store, availableCardWatcher });

      const card = {
        id: 'abc',
        front: 'Question',
        back: 'Answer',
        progress: {
          due: new Date(),
        },
      } as Card;
      mockStore.__update({
        screen: 'review',
        review: {
          ...initialState.review,
          currentCard: card,
        },
      });

      const updatedCard = {
        ...card,
        front: 'Updated question',
      };
      mockDataStore.__triggerChange('card', {
        deleted: true,
        card: updatedCard,
      });

      expect(mockStore.actions).toContainEqual(
        expect.objectContaining({ type: 'DELETE_REVIEW_CARD', id: 'abc' })
      );
    });

    it('does NOT trigger an update when there is no change to the card', () => {
      subject({ dataStore, store, availableCardWatcher });

      const card = {
        id: 'abc',
        front: 'Question',
        back: 'Answer',
        progress: {
          due: new Date(),
        },
      } as Card;
      mockStore.__update({
        screen: 'review',
        review: {
          ...initialState.review,
          currentCard: card,
        },
      });

      mockDataStore.__triggerChange('card', { card });

      expect(mockStore.actions).not.toContainEqual(updateReviewCard(card));
    });

    it('does NOT trigger an update when an unrelated card is updated', () => {
      subject({ dataStore, store, availableCardWatcher });

      const card = {
        id: 'abc',
        front: 'Question',
        back: 'Answer',
        progress: {
          due: new Date(),
        },
      } as Card;
      mockStore.__update({
        screen: 'review',
        review: {
          ...initialState.review,
          currentCard: card,
        },
      });

      mockDataStore.__triggerChange('card', {
        card: {
          ...card,
          id: 'xyz',
        },
      });

      expect(mockStore.actions).not.toContainEqual(updateReviewCard(card));
    });

    it('does NOT trigger an update when an unrelated card is deleted', () => {
      subject({ dataStore, store, availableCardWatcher });

      const card = {
        id: 'abc',
        front: 'Question',
        back: 'Answer',
        progress: {
          due: new Date(),
        },
      } as Card;
      mockStore.__update({
        screen: 'review',
        review: {
          ...initialState.review,
          currentCard: card,
        },
      });

      mockDataStore.__triggerChange('card', {
        card: {
          ...card,
          id: 'xyz',
        },
        deleted: true,
      });

      expect(mockStore.actions).not.toContainEqual(
        expect.objectContaining({ type: 'DELETE_REVIEW_CARD', id: 'xyz' })
      );
    });
  });

  describe('review state', () => {
    it('triggers a sync when the review has changed', () => {
      subject({ dataStore, store, availableCardWatcher });

      mockStore.__update({
        screen: 'review',
        review: initialState.review,
      });

      const review = {
        maxCards: 3,
        maxNewCards: 2,
        completed: 1,
        newCardsCompleted: 0,
        history: ['abc', 'def'],
        failed: ['def'],
      };

      mockDataStore.__triggerChange('review', review as Review);
      expect(mockStore.actions).toContainEqual(
        expect.objectContaining({ type: 'LOAD_REVIEW', review })
      );
    });

    it('does NOT trigger a sync when nothing has changed', () => {
      subject({ dataStore, store, availableCardWatcher });

      mockStore.__update({
        screen: 'review',
        review: initialState.review,
      });
      const reviewSummary = getReviewSummary(initialState);

      mockDataStore.__triggerChange('review', reviewSummary);
      expect(mockStore.actions).not.toContainEqual(
        expect.objectContaining({ type: 'LOAD_REVIEW', review: reviewSummary })
      );
    });

    it('cancels the review when the review is deleted', () => {
      subject({ dataStore, store, availableCardWatcher });
      mockStore.__update({
        screen: 'review',
        review: {
          ...initialState.review,
          phase: ReviewPhase.Front,
        },
      });

      mockDataStore.__triggerChange('review', null);

      expect(mockStore.actions).toContainEqual(
        expect.objectContaining({ type: 'CANCEL_REVIEW' })
      );
    });
  });
});
