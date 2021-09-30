'use strict';

const React = require('react');

const TodoItem = React.createClass({

  getInitialState: function() {
    return {
      item: '',
      remove: false
    };
  },

  componentDidMount: function() {
    this.setState({item: this.props.value})
  },

  componentWillReceiveProps: function(nextProps) {
    this.setState({item: nextProps.value})
  },

  removeItem: function() {
    this.props.removeItem(this.props.id)
  },

  showOptions: function(e) {
    var state = e.type === "mouseenter" ? true : false;
    this.setState({remove: state})
  },

  render: function() {

    let remove = (<button onClick={this.removeItem}>Remove</button>);
    (!this.state.remove || this.props.authkey !== 'accepted') && (remove = null);

    return (
      <li className="todoItem"
        onMouseEnter={this.showOptions}
        onMouseLeave={this.showOptions}>
         {this.state.item}
         {remove}
      </li>
    );
  }

});

module.exports = TodoItem;
