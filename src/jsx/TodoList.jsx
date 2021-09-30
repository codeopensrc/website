'use strict';

const React = require('react');

const TodoItem = require("./TodoItem.jsx");

const TodoList = React.createClass({

  getInitialState: function() {
    return {
      items: [],
      addItem: false,
      authKey: "",
    };
  },

  componentWillMount: function() {
    this.getItems();
    (localStorage.getItem("key") === '' || localStorage.getItem("key") === null) ?
        localStorage.setItem("key", window.location.search.replace(/\?/gm, '')) : '';
    let key = localStorage.getItem("key");
    this.getKey(key);
  },

  getKey: function (key) {
    var _this = this;
    $.post("/ajaxAuth", JSON.stringify({storageKey: key}), (data) => {
        this.setState({
          authKey: data.storageKey
        })
      }, "json")
  },

  addItem: function() {
    this.setState({addItem: !this.state.addItem})
  },

  removeItem: function(id) {
    let key = localStorage.getItem("key")
    $.post("/ajaxRemoveTodoItem", JSON.stringify({storageKey: key, id: id}), () => {
      this.getItems();
    })
  },

  submitItem: function() {
    let item = document.getElementById("newTodoItem").value;
    let key = localStorage.getItem("key")
    $.post("/ajaxSubmitTodoItem", JSON.stringify({storageKey: key, value: item}), () => {
      this.getItems();
      document.getElementById("newTodoItem").value = '';
    })
  },

  getItems: function() {
    $.get("/ajaxGetTodo", (data) => {
      this.setState({items: JSON.parse(data)})
    })
  },

  render: function() {

    let input = ( <div>
                    <input type="text" id="newTodoItem" />
                    <button onClick={this.submitItem}>Submit</button>
                </div> );
    !this.state.addItem && (input = null);

    let toggle = this.state.addItem ? "Cancel" : "Add";

    let addButton = <button onClick={this.addItem}>{toggle}</button>
    this.state.authKey !== "accepted" && (addButton = null);

    let items = this.state.items.map((item, i) => {
        return <TodoItem key={"todoItem"+i} removeItem={this.removeItem}
                value={item.value} id={item._id} authkey={this.state.authKey}/>
    })

    return (
      <div id="todoList">
        <h1>Todo List:</h1>
        {addButton}
        {input}
        {items}
      </div>
    );
  }

});

module.exports = TodoList;
