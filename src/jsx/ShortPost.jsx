"use strict";

const React = require('react');

const Post = React.createClass({

  checkDelete: function() {
    if(confirm("Are you sure? (Ok to delete)")) {
      this.props.deletePost(this);
    }
  },

  findUnclosedHTML: function(brokenDownMessage) {
    let openingTags = [];
    let closingTags = [];
    let tags = [["div", "</div>"], ["em", "</em>"], ["strong", "</strong>"],
        ["code", "</code>"], ["pre", "</pre>"], ["a href", "</a>"], ["li", "</li>"],
    ["ul", "</ul>"]]
    let matches = brokenDownMessage.match(/(<[\w\s"'=]*>)|(<\/[\w\s"'=]*>)/g)
    if(!matches) { return [] }
    matches.forEach((tag) => {
        let opening = tag.match(/<([\w\s'"=]*)>/);
        let closing = tag.match(/<\/([\w\s'"=]*)>/)
        opening && openingTags.push(opening[1])
        closing && closingTags.push(closing[1])
    })
    closingTags.forEach((tag) => {
        let ind = null;
        openingTags.some((openTag) => {
            let i = openTag.indexOf(tag);
            if(i > -1) { ind = i; return true; }
        })
        ind > -1 && openingTags.splice(ind, 1);
    })
    let unClosed = openingTags.map((openTag) => {
            return tags.filter((tagArr) => openTag.indexOf(tagArr[0]) > -1)[0][1]
        }
    )
    return unClosed.reverse()
  },

  createReadMore: function(brokenDownMessage) {
      if(typeof brokenDownMessage !== "object") { throw Error("brokenDownMessage is not an array")}
      let foundHTML = this.findUnclosedHTML(brokenDownMessage[0]);
      foundHTML.length && foundHTML.forEach((closingTag) => {
          brokenDownMessage[0] += closingTag
      })
      return brokenDownMessage[0]+"  ....  <br/><br/><a href='"+this.props.url+
          "' target='_blank'>Read More</a><br/> "
  },

  createBody: function() {
      let postBody = this.props.message.replace(/\n/g, "<br/> ");
      let brokenDownMessage = postBody.match(/([^.?!]+[.?!]){1,10}/g);
      if(brokenDownMessage && brokenDownMessage.length > 2) {
          postBody = this.createReadMore(brokenDownMessage)
      }
      return postBody
  },

  render: function() {

    let editButton = <button id="editPost" onClick={this.props.editPost}>Edit post</button>
    this.props.authKey !== "accepted" && (editButton = null);

    let deleteButton = <div className="delete" onClick={this.checkDelete}>Delete</div>
    this.props.authKey !== "accepted" && (deleteButton = null);

    return (
          <div key={this.props.id} id={this.props.id} className="post">
            {deleteButton}
            <div className="postTitle">
              <a href={this.props.url} target="_blank">
                {this.props.title}
              </a>
            </div>
            <div className="postDate">
              {this.props.date}
            </div>
            <div className="postBody" dangerouslySetInnerHTML={{__html: this.createBody()}}>
            </div>
            {editButton}
        </div>
      )
    }

});

module.exports = Post;
