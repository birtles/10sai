/* global afterEach, beforeEach, describe, expect, it */
/* eslint arrow-body-style: [ "off" ] */

import memdown from 'memdown';
import CardStore from './CardStore';
import { waitForEvents } from '../test/testcommon';

describe('CardStore', () => {
  let subject;

  beforeEach(() => {
    subject = new CardStore({ pouch: { db: memdown }, prefetchViews: false });
  });

  afterEach(() => subject.destroy());

  it('is initially empty', async () => {
    const cards = await subject.getCards();
    expect(cards).toHaveLength(0);
  });

  it('returns added cards', async () => {
    await subject.putCard({ question: 'Question', answer: 'Answer' });
    const cards = await subject.getCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Question');
    expect(cards[0].answer).toBe('Answer');
  });

  it('returns individual cards', async () => {
    let card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    card = await subject.getCard(card._id);
    expect(card.question).toBe('Question');
    expect(card.answer).toBe('Answer');
  });

  it('does not return non-existent cards', async () => {
    // TODO: We should be able to write this as:
    //
    // await expect(subject.getCard('abc')).rejects.toMatchObject({
    //   status: 404,
    //   name: 'not_found',
    //   message: 'missing',
    //   reason: 'missing',
    // });
    //
    // But https://github.com/facebook/jest/issues/5359 :(
    try {
      await subject.getCard('abc');
      expect(false).toBe(true);
    } catch (err) {
      expect(err.status).toBe(404);
      expect(err.name).toBe('not_found');
      expect(err.message).toBe('missing');
      expect(err.reason).toBe('missing');
    }
  });

  it('generates unique ascending IDs', () => {
    let prevId = '';
    for (let i = 0; i < 100; i++) {
      const id = CardStore.generateCardId();
      expect(id > prevId).toBeTruthy();
      prevId = id;
    }
  });

  it('does not return the prefix when putting a card', async () => {
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    expect(card._id.substr(0, 5)).not.toBe('card-');
  });

  it('does not return the prefix when getting a single card', async () => {
    let card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    card = await subject.getCard(card._id);
    expect(card._id.substr(0, 5)).not.toBe('card-');
  });

  it('does not return the prefix when getting multiple cards', async () => {
    await subject.putCard({ question: 'Q1', answer: 'A1' });
    await subject.putCard({ question: 'Q2', answer: 'A2' });

    const cards = await subject.getCards();
    for (const card of cards) {
      expect(card._id.substr(0, 5)).not.toBe('card-');
    }
  });

  it('returns added cards in order', async () => {
    const card1 = await subject.putCard({ question: 'Q1', answer: 'A1' });
    const card2 = await subject.putCard({ question: 'Q2', answer: 'A2' });

    const cards = await subject.getCards();
    // Sanity check: card IDs are unique
    expect(card1._id).not.toBe(card2._id);

    expect(cards).toHaveLength(2);
    expect(cards[0]._id).toBe(card2._id);
    expect(cards[1]._id).toBe(card1._id);
  });

  it('reports added cards', async () => {
    let updateInfo;
    subject.changes.on('change', info => {
      updateInfo = info;
    });

    const addedCard = await subject.putCard({ question: 'Q1', answer: 'A1' });
    // Wait for a few rounds of events so the update can take place
    await waitForEvents(3);

    expect(updateInfo).toMatchObject({ id: addedCard._id });
  });

  it('does not return deleted cards', async () => {
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    await subject.deleteCard(card);

    const cards = await subject.getCards();

    expect(cards).toHaveLength(0);
  });

  it('does not return individual deleted cards', async () => {
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    const id = card._id;
    await subject.deleteCard(card);

    // TODO: As before we should be able to write this as
    //
    // await expect(subject.getCard(id)).rejects.toMatchObject({
    //   status: 404,
    //   name: 'not_found',
    //   message: 'missing',
    //   reason: 'deleted',
    // });
    try {
      await subject.getCard(id);
      expect(false).toBe(true);
    } catch (err) {
      expect(err.status).toBe(404);
      expect(err.name).toBe('not_found');
      expect(err.message).toBe('missing');
      expect(err.reason).toBe('deleted');
    }
  });

  it('deletes the specified card', async () => {
    const firstCard = await subject.putCard({
      question: 'Question 1',
      answer: 'Answer 1',
    });
    await subject.putCard({ question: 'Question 2', answer: 'Answer 2' });

    await subject.deleteCard(firstCard);

    const cards = await subject.getCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Question 2');
    expect(cards[0].answer).toBe('Answer 2');
  });

  it('reports an error when the card to be deleted cannot be found', async () => {
    // TODO: As before we should be able to write this as
    //
    // await expect(subject.deleteCard({ _id: 'abc' })).rejects.toMatchObject({
    //   status: 404,
    //   name: 'not_found',
    //   message: 'missing',
    //   reason: 'deleted',
    // });
    try {
      await subject.deleteCard({ _id: 'abc' });
      expect(false).toBe(true);
    } catch (err) {
      expect(err.status).toBe(404);
      expect(err.name).toBe('not_found');
      expect(err.message).toBe('missing');
      expect(err.reason).toBe('deleted');
    }
  });

  it('deletes the specified card even when the revision is old', async () => {
    const card = await subject.putCard({
      question: 'Question 1',
      answer: 'Answer 1',
    });
    await subject.putCard({ ...card, question: 'Updated question' });

    await subject.deleteCard(card);

    const cards = await subject.getCards();
    expect(cards).toHaveLength(0);
  });

  it('reports deleted cards', async () => {
    let updateInfo;
    subject.changes.on('change', info => {
      updateInfo = info;
    });
    const addedCard = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });

    await subject.deleteCard(addedCard);

    await waitForEvents(5);
    expect(updateInfo.id).toBe(addedCard._id);
    expect(updateInfo.deleted).toBeTruthy();
  });

  it('updates the specified field of cards', async () => {
    let card = await subject.putCard({
      question: 'Original question',
      answer: 'Answer',
    });

    card = await subject.putCard({
      _id: card._id,
      _rev: card._rev,
      question: 'Updated question',
    });

    expect(card.question).toBe('Updated question');
    expect(card.answer).toBe('Answer');

    const cards = await subject.getCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Updated question');
    expect(cards[0].answer).toBe('Answer');
  });

  it('updates cards even without a revision', async () => {
    let card = await subject.putCard({
      question: 'Original question',
      answer: 'Answer',
    });

    card = await subject.putCard({
      _id: card._id,
      question: 'Updated question',
    });

    expect(card.question).toBe('Updated question');
    expect(card.answer).toBe('Answer');

    const cards = await subject.getCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Updated question');
    expect(cards[0].answer).toBe('Answer');
  });

  it('updates cards even when the revision is old', async () => {
    let card = await subject.putCard({
      question: 'Original question',
      answer: 'Answer',
    });
    const oldRevision = card._rev;
    card = await subject.putCard({
      _id: card._id,
      question: 'Updated question',
    });

    await subject.putCard({
      _id: card._id,
      _rev: oldRevision,
      answer: 'Updated answer',
    });

    const cards = await subject.getCards();
    expect(cards).toHaveLength(1);
    expect(cards[0].question).toBe('Updated question');
    expect(cards[0].answer).toBe('Updated answer');
  });

  it('returns an error when trying to update a missing card', async () => {
    // TODO: As before we should be able to write this as
    //
    // await expect(subject.putCard(...)).rejects.toMatchObject({
    //   status: 404,
    //   name: 'not_found',
    //   message: 'missing',
    // });
    try {
      await subject.putCard({ _id: 'abc', question: 'Question' });
      expect(false).toBe(true);
    } catch (err) {
      expect(err.status).toBe(404);
      expect(err.name).toBe('not_found');
      expect(err.message).toBe('missing');
    }
  });

  it('returns an error when trying to update a deleted card', async () => {
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    await subject.deleteCard(card);

    // TODO: As before we should be able to write this as
    //
    // await expect(subject.putCard(...)).rejects.toMatchObject({
    //   status: 404,
    //   name: 'not_found',
    //   message: 'missing',
    // });
    try {
      await subject.putCard({ _id: card._id, question: 'Updated question' });
      expect(false).toBe(true);
    } catch (err) {
      expect(err.status).toBe(404);
      expect(err.name).toBe('not_found');
      expect(err.message).toBe('missing');
    }
  });

  it('stores the created date when adding a new card', async () => {
    const beginDate = new Date();
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    expect(new Date(card.created)).toBeInDateRange(beginDate, new Date());
  });

  it('stores the last modified date when adding a new card', async () => {
    const beginDate = new Date();
    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    expect(new Date(card.modified)).toBeInDateRange(beginDate, new Date());
  });

  it('updates the last modified date when updating a card', async () => {
    let card = await subject.putCard({
      question: 'Original question',
      answer: 'Answer',
    });
    const beginDate = new Date();
    card = await subject.putCard({
      _id: card._id,
      question: 'Updated question',
    });
    expect(new Date(card.modified)).toBeInDateRange(beginDate, new Date());
  });

  it('reports changes to cards', async () => {
    const updates = [];
    subject.changes.on('change', info => {
      updates.push(info);
    });

    const card = await subject.putCard({
      question: 'Question',
      answer: 'Answer',
    });
    await subject.putCard({ ...card, question: 'Updated question' });

    // Wait for a few rounds of events so the update records can happen
    await waitForEvents(5);

    // Should get two change records: add, update
    expect(updates).toHaveLength(2);
    expect(updates[1].doc.question).toBe('Updated question');
  });
});