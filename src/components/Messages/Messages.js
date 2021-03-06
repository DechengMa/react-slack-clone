import React, { Component } from 'react';
import { Segment, Comment } from 'semantic-ui-react';
import { connect } from 'react-redux';
import { setUserPosts } from '../../actions';
import firebase from '../../firebase';

import MessageHeader from './MessagesHeader';
import MessageForm from './MessageForm';
import Message from './Message';
import Typing from './Typing';
import Skeleton from './Skeleton';

class Messages extends Component {
	state = {
		privateChannel: this.props.isPrivateChannel,
		privateMessagesRef: firebase.database().ref('privateMessages'),
		messagesRef: firebase.database().ref('messages'),
		messages: [],
		messagesLoading: true,
		isChannelStarred: false,
		channel: this.props.currentChannel,
		user: this.props.currentUser,
		usersRef: firebase.database().ref('users'),
		typingRef: firebase.database().ref('typing'),
		numUniqueUsers: '',
		searchTerm: '',
		searchLoading: false,
		searchResults: [],
		typingUsers: [],
		connectedRef: firebase.database().ref('.info/connected'),
		listeners: []
	};

	componentDidMount() {
		const { channel, user, listeners } = this.state;

		if (channel && user) {
			this.removeListeners(listeners);
			this.addListeners(channel.id);
			this.addUserStarsListener(channel.id, user.uid);
		}
	}

	componentDidUpdate(prevProps, prevState) {
		if (this.messagesEnd) {
			this.scrollToBottom();
		}
	}

	componentWillUnmount() {
		this.removeListeners(this.state.listeners);
		this.state.connectedRef.off();
	}

	addToListeners = (id, ref, event) => {
		const index = this.state.listeners.findIndex(listener => {
			return (
				listener.id === id && listener.ref === ref && listener.event === event
			);
		});

		if (index === -1) {
			const newListener = { id, ref, event };
			this.setState({ listeners: this.state.listeners.concat(newListener) });
		}
	};

	removeListeners = listeners => {
		listeners.forEach(listener => {
			listener.ref.child(listener.id).off(listener.event);
		});
	};

	scrollToBottom = () => {
		this.messagesEnd.scrollIntoView({ behaviour: 'smooth' });
	};

	addListeners = channelId => {
		this.addMessageListener(channelId);
		this.addTypingListeners(channelId);
	};

	addTypingListeners = channelId => {
		let typingUsers = [];
		this.state.typingRef.child(channelId).on('child_added', snap => {
			if (snap.key !== this.state.user.uid) {
				typingUsers = typingUsers.concat({
					id: snap.key,
					name: snap.val()
				});
				this.setState({ typingUsers });
			}
		});
		this.addToListeners(channelId, this.state.typingRef, 'child_added');

		this.state.typingRef.child(channelId).on('child_removed', snap => {
			const index = typingUsers.findIndex(user => user.id === snap.key);
			if (index !== -1) {
				typingUsers = typingUsers.filter(user => user.id !== snap.key);
				this.setState({ typingUsers });
			}
		});
		this.addToListeners(channelId, this.state.typingRef, 'child_removed');

		this.state.connectedRef.on('value', snap => {
			if (snap.val() === true) {
				this.state.typingRef
					.child(channelId)
					.child(this.state.user.uid)
					.onDisconnect()
					.remove(err => {
						if (err !== null) {
							console.error(err);
						}
					});
			}
		});
	};

	addUserStarsListener = (channelId, userId) => {
		this.state.usersRef
			.child(userId)
			.child('starred')
			.once('value')
			.then(data => {
				if (data.val() !== null) {
					const channelIds = Object.keys(data.val());
					const prevStarred = channelIds.includes(channelId);
					this.setState({ isChannelStarred: prevStarred });
				}
			});
	};

	addMessageListener = channelId => {
		let loadedMessages = [];
		const ref = this.getMessagesRef();
		ref.child(channelId).on('child_added', snap => {
			loadedMessages.push(snap.val());
			this.setState({
				messages: loadedMessages,
				messagesLoading: false
			});
			this.countUniqueUsers(loadedMessages);
			this.countUserPosts(loadedMessages);
		});
		this.addToListeners(channelId, ref, 'child_added');
	};

	countUserPosts = messages => {
		let userPosts = messages.reduce((acc, message) => {
			if (message.user.name in acc) {
				acc[message.user.name].count += 1;
			} else {
				acc[message.user.name] = {
					avatar: message.user.avatar,
					count: 1
				};
			}
			return acc;
		}, {});
		this.props.setUserPosts(userPosts);
	};

	handleSearchChange = event => {
		this.setState(
			{
				searchTerm: event.target.value,
				searchLoading: true
			},
			() => this.handleSearchMessages()
		);
	};

	handleSearchMessages = () => {
		const changeMessages = [...this.state.messages];
		const regex = new RegExp(this.state.searchTerm, 'gi');
		const searchResults = changeMessages.reduce((acc, message) => {
			if (
				(message.content && message.content.match(regex)) ||
				message.user.name.match(regex)
			) {
				acc.push(message);
			}

			return acc;
		}, []);
		this.setState({ searchResults });
		setTimeout(() => {
			this.setState({ searchLoading: false });
		}, 1000);
	};

	countUniqueUsers = messages => {
		const uniqueUsers = messages.reduce((acc, message) => {
			if (!acc.includes(message.user.name)) {
				acc.push(message.user.name);
			}
			return acc;
		}, []);

		const plural = uniqueUsers.length > 1 || uniqueUsers.length === 0;
		const numUniqueUsers = `${uniqueUsers.length} User${plural ? 's' : ''}`;

		this.setState({
			numUniqueUsers
		});
	};

	getMessagesRef = () => {
		const { messagesRef, privateMessagesRef, privateChannel } = this.state;
		return privateChannel ? privateMessagesRef : messagesRef;
	};

	displayMessages = messages =>
		messages.length > 0 &&
		messages.map(message => (
			<Message
				key={message.timestamp}
				message={message}
				user={this.state.user}
			/>
		));

	handleStar = () => {
		this.setState(
			prevState => ({
				isChannelStarred: !prevState.isChannelStarred
			}),
			() => this.starChannel()
		);
	};

	starChannel = () => {
		if (this.state.isChannelStarred) {
			this.state.usersRef.child(`${this.state.user.uid}/starred`).update({
				[this.state.channel.id]: {
					name: this.state.channel.name,
					details: this.state.channel.details,
					createdBy: {
						name: this.state.channel.createdBy.name,
						avatar: this.state.channel.createdBy.avatar
					}
				}
			});
		} else {
			this.state.usersRef
				.child(`${this.state.user.uid}/starred`)
				.child(this.state.channel.id)
				.remove(err => {
					if (err !== null) {
						console.error(err);
					}
				});
		}
	};

	displayChannelName = channel => {
		return channel
			? `${this.state.privateChannel ? '@' : '#'}${channel.name}`
			: '';
	};

	displayTypingUsers = users =>
		users.length > 0 &&
		users.map(user => (
			<div
				style={{ display: 'flex', alignItems: 'center', marginBottom: '0.2em' }}
				key={user.id}
			>
				<span className='user__typing'>{user.name} is typing</span> <Typing />
			</div>
		));

	displayMessageSkeleton = loading =>
		loading ? (
			<React.Fragment>
				{[...Array(10)].map((_, i) => (
					<Skeleton key={i} />
				))}
			</React.Fragment>
		) : null;

	render() {
		const {
			messagesRef,
			messages,
			channel,
			user,
			numUniqueUsers,
			searchTerm,
			searchResults,
			searchLoading,
			privateChannel,
			isChannelStarred,
			typingUsers,
			messagesLoading
		} = this.state;
		return (
			<>
				<MessageHeader
					channelName={this.displayChannelName(channel)}
					numUniqueUsers={numUniqueUsers}
					handleSearchChange={this.handleSearchChange}
					searchLoading={searchLoading}
					isPrivateChannel={privateChannel}
					handleStar={this.handleStar}
					isChannelStarred={isChannelStarred}
				/>

				<Segment>
					<Comment.Group className='messages'>
						{this.displayMessageSkeleton(messagesLoading)}
						{searchTerm
							? this.displayMessages(searchResults)
							: this.displayMessages(messages)}
						{this.displayTypingUsers(typingUsers)}
						<div ref={node => (this.messagesEnd = node)} />
					</Comment.Group>
				</Segment>

				<MessageForm
					messagesRef={messagesRef}
					currentChannel={channel}
					currentUser={user}
					isPrivateChannel={privateChannel}
					getMessagesRef={this.getMessagesRef}
				/>
			</>
		);
	}
}

export default connect(null, { setUserPosts })(Messages);
