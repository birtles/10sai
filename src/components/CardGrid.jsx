import React from 'react';
import PropTypes from 'prop-types';
import { collate } from 'pouchdb-collate';
import CardPreview from './CardPreview.jsx';
import Link from './Link.jsx';
import VirtualGrid from './VirtualGrid.jsx';

// Perform a binary search in |cards| for card with _id |id|.
//
// Returns a pair [found, index]. If |found| is true, |index| is the index of
// matching card in |cards|. If |found| is false, |index| is the index to use
// such that cards.splice(index, 0, card) would keep |cards| sorted.
function findCard(id, cards) {
  let min = 0;
  let max = cards.length - 1;
  let guess;

  while (min <= max) {
    guess = Math.floor((min + max) / 2);

    const result = collate(cards[guess]._id, id);

    if (result === 0) {
      return [ true, guess ];
    }

    if (result > 0) {
      min = guess + 1;
    } else {
      max = guess - 1;
    }
  }

  return [ false, Math.max(min, max) ];
}

export class CardGrid extends React.Component {
  static get contextTypes() {
    return { cardStore: PropTypes.object };
  }

  static renderTemplateCard() {
    return (
      <CardPreview
        _id="template"
        question="Template" />);
  }

  static renderCard(item) {
    return (
      <Link href={`/cards/${item._id}`}>
        <CardPreview {...item} />
      </Link>);
  }

  constructor(props) {
    super(props);
    this.state = { cards: [] };
  }

  componentDidMount() {
    // Get initial set of cards
    this.context.cardStore.getCards().then(cards => {
      this.setState({ cards });
    });

    this.context.cardStore.changes.on('change', change => {
      const cards = this.state.cards.slice();
      const [ found, index ] = findCard(change.id, cards);
      if (found) {
        if (change.deleted) {
          cards.splice(index, 1);
        } else {
          cards[index] = change.doc;
        }
        this.setState({ cards });
      } else if (!change.deleted) {
        cards.splice(index, 0, change.doc);
        this.setState({ cards });
      }
    });
  }

  render() {
    return (
      <VirtualGrid
        items={this.state.cards}
        className="card-grid"
        renderItem={CardGrid.renderCard}
        renderTemplateItem={CardGrid.renderTemplateCard} />);
  }
}

export default CardGrid;
