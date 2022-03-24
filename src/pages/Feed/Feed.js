import React, { Component, Fragment } from 'react';

import Post from '../../components/Feed/Post/Post';
import Button from '../../components/Button/Button';
import FeedEdit from '../../components/Feed/FeedEdit/FeedEdit';
import Input from '../../components/Form/Input/Input';
import Paginator from '../../components/Paginator/Paginator';
import Loader from '../../components/Loader/Loader';
import ErrorHandler from '../../components/ErrorHandler/ErrorHandler';
import './Feed.css';


class Feed extends Component {
  state = {
    isEditing: false,
    posts: [],
    totalPosts: 0,
    editPost: null,
    status: '',
    postPage: 1,
    perPage: 2,
    postsLoading: true,
    editLoading: false
  };

  componentDidMount() {
    let graphqlQuery = {
      query: `{
        user{
          name
          status
        }
      }`
    }
    fetch('http://localhost:8080/graphql', {
      method: "POST",
      headers: {
        'Authorization': 'Bearer ' + this.props.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    })
      .then(res => {
        return res.json();
      })
      .then(resData => {
        if (resData.errors) {
          throw new Error("Status Fetching failed!");
        }
        this.setState({ status: resData.data.user.status });
      })
      .catch(this.catchError);

    this.loadPosts();
  }


  loadPosts = direction => {
    if (direction) {
      this.setState({ postsLoading: true, posts: [] });
    }
    let page = this.state.postPage;
    let perPage = this.state.perPage;
    if (direction === 'next') {
      page++;
      this.setState({ postPage: page });
    }
    if (direction === 'previous') {
      page--;
      this.setState({ postPage: page });
    }
    // console.log(typeof page, perPage);
    const graphqlQuery =
        {
          query: `{
            getPosts(pagination: {page: ${page}, perPage:${perPage}}){
              posts {
                _id
                title
                content
                creator {
                  _id
                  name
                  email
                }
                imageURL
                createdAt
              }
              totalItems
            }
          }`
        }
    fetch('http://localhost:8080/graphql', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + this.props.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    })
      .then(res => {
        return res.json();
      })
      .then(resData => {
        console.log(resData);
        if (resData.errors) {
          throw new Error("Post Fetching failed!");
        }
        this.setState({
          posts: resData.data.getPosts.posts.map(post => {
            return {
              ...post,
              imagePath: post.imageURL
            };
          }),
          totalPosts: resData.data.getPosts.totalItems,
          postsLoading: false
        });
      })
      .catch(this.catchError);
  };

  statusUpdateHandler = event => {
    event.preventDefault();

    let graphqlQuery = {
      query: `     
        mutation{
          updateUser(status: "${this.state.status}"){
            status
          }
        }
      `
    }
    fetch('http://localhost:8080/graphql', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + this.props.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    })
      .then(res => {
        return res.json();
      })
      .then(resData => {
        if (resData.errors) {
          throw new Error("Status Updating failed!");
        }
        this.setState({ status: resData.data.updateUser.status });

      })
      .catch(this.catchError);
  };

  newPostHandler = () => {
    this.setState({ isEditing: true });
  };

  startEditPostHandler = postId => {
    this.setState(prevState => {
      const loadedPost = { ...prevState.posts.find(p => p._id === postId) };

      return {
        isEditing: true,
        editPost: loadedPost
      };
    });
  };

  cancelEditHandler = () => {
    this.setState({ isEditing: false, editPost: null });
  };

  finishEditHandler = postData => {

    this.setState({
      editLoading: true
    });
    const formData = new FormData();
    // formData.append('title', postData.title);
    // formData.append('content', postData.content);
    formData.append('image', postData.image);
    if (this.state.editPost) {
      formData.append('oldPath', this.state.editPost.imagePath);
    }

    fetch('http://localhost:8080/post-image', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + this.props.token
      },
      body: formData
    })
        .then(res => res.json())
        .then(fileResData => {
          const imageUrl = fileResData.filePath;
          let graphqlQuery = {
            query: `
       mutation {
            createPost(postInput:{title: "${postData.title}", content:"${postData.content}", imageURL:"${imageUrl}"}){
            _id
            title
            content
            creator {
              name
            }
            createdAt
            updatedAt
          }
        
        }
      `
          }


          if (this.state.editPost) {
            graphqlQuery = {
              query: `             
                  mutation{
                    updatePost(postId: "${this.state.editPost._id}", postData:{title: "${postData.title}", content:"${postData.content}", imageURL: "${imageUrl}"}){
                      _id
                      title
                      content
                      imageURL
                      createdAt
                      updatedAt
                      creator {
                        _id
                        name
                      }
                    }
                  }
            `
            }
          }

          console.log(graphqlQuery);
          let url = 'http://localhost:8080/graphql';
          let method = 'POST';
          fetch(url, {
            method: method,
            headers: {
              'Authorization': 'Bearer ' + this.props.token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(graphqlQuery)
          })
              .then(res => {
                console.log(res);
                return res.json();
              })
              .then(resData => {
                console.log(resData);
                if (resData.errors && resData.errors[0].status === 422) {
                  throw new Error(
                      "Validation Failed. Make sure the email address isn't used yet"
                  )
                }
                if (resData.errors) {
                  throw new Error("User creation failed!");
                }

                let fetchedData = "createPost";
                if (this.state.editPost) {
                  fetchedData = "updatePost";
                }
                const post = {
                  _id: resData.data[fetchedData]._id,
                  title: resData.data[fetchedData].title,
                  content: resData.data[fetchedData].content,
                  creator: resData.data[fetchedData].creator,
                  createdAt: resData.data[fetchedData].createdAt
                };
                this.setState(prevState => {
                  let updatedPosts = [...prevState.posts];
                  if (prevState.editPost) {
                    const postIndex = prevState.posts.findIndex(
                        p => p._id === prevState.editPost._id
                    );
                    updatedPosts[postIndex] = post;
                  } else {
                    updatedPosts.pop();
                    updatedPosts.unshift(post);
                  }
                  return {
                    posts: updatedPosts,
                    isEditing: false,
                    editPost: null,
                    editLoading: false
                  };
                });
              })
              .catch(err => {
                console.log(err);
                this.setState({
                  isEditing: false,
                  editPost: null,
                  editLoading: false,
                  error: err
                });
              });
        })

  };

  statusInputChangeHandler = (input, value) => {
    this.setState({ status: value });
  };

  deletePostHandler = postId => {
    this.setState({ postsLoading: true });

    let graphqlQuery = {
      query: `     
      mutation{
        deletePost(postID: "${postId}") {
          success
        }
      }
      `
    }
    fetch('http://localhost:8080/graphql', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + this.props.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(graphqlQuery),
    })
      .then(res => {
        return res.json();
      })
      .then(resData => {
        if (resData.errors) {
          throw new Error("Post deletion failed!");
        }

        this.setState(prevState => {
          const updatedPosts = prevState.posts.filter(p => p._id !== postId);
          return { posts: updatedPosts, postsLoading: false };
        });
      })
      .catch(err => {
        console.log(err);
        this.setState({ postsLoading: false });
      });
  };

  errorHandler = () => {
    this.setState({ error: null });
  };

  catchError = error => {
    this.setState({ error: error });
  };

  render() {
    return (
      <Fragment>
        <ErrorHandler error={this.state.error} onHandle={this.errorHandler} />
        <FeedEdit
          editing={this.state.isEditing}
          selectedPost={this.state.editPost}
          loading={this.state.editLoading}
          onCancelEdit={this.cancelEditHandler}
          onFinishEdit={this.finishEditHandler}
        />
        <section className="feed__status">
          <form onSubmit={this.statusUpdateHandler}>
            <Input
              type="text"
              placeholder="Your status"
              control="input"
              onChange={this.statusInputChangeHandler}
              value={this.state.status}
            />
            <Button mode="flat" type="submit">
              Update
            </Button>
          </form>
        </section>
        <section className="feed__control">
          <Button mode="raised" design="accent" onClick={this.newPostHandler}>
            New Post
          </Button>
        </section>
        <section className="feed">
          {this.state.postsLoading && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <Loader />
            </div>
          )}
          {this.state.posts.length <= 0 && !this.state.postsLoading ? (
            <p style={{ textAlign: 'center' }}>No posts found.</p>
          ) : null}
          {!this.state.postsLoading && (
            <Paginator
              onPrevious={this.loadPosts.bind(this, 'previous')}
              onNext={this.loadPosts.bind(this, 'next')}
              lastPage={Math.ceil(this.state.totalPosts / 2)}
              currentPage={this.state.postPage}
            >
              {this.state.posts.map(post => (
                <Post
                  key={post._id}
                  id={post._id}
                  author={post.creator.name}
                  date={new Date(post.createdAt).toLocaleDateString('en-US')}
                  title={post.title}
                  image={post.imageUrl}
                  content={post.content}
                  onStartEdit={this.startEditPostHandler.bind(this, post._id)}
                  onDelete={this.deletePostHandler.bind(this, post._id)}
                />
              ))}
            </Paginator>
          )}
        </section>
      </Fragment>
    );
  }
}

export default Feed;
