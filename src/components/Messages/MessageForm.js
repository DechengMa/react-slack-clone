import React, { Component } from 'react';
import firebase from '../../firebase';
import uuidv4 from 'uuid/v4';
import { Segment, Button, Input } from 'semantic-ui-react';
import { Picker, emojiIndex } from 'emoji-mart';
import 'emoji-mart/css/emoji-mart.css';

import FileModal from './FileModal';
import ProgressBar from './ProgressBar';

class MessageForm extends Component {
	state = {
		storageRef: firebase.storage().ref(),
		typingRef: firebase.database().ref('typing'),
		uploadTask: null,
		uploadState: '',
		percentageUploaded: 0,
		message: '',
		loading: false,
		user: this.props.currentUser,
		channel: this.props.currentChannel,
		errors: [],
		modal: false,
		emojiPicker: false
	};

	openModal = () => this.setState({ modal: true });

	closeModal = () => this.setState({ modal: false });

	handleTogglePicker = () => {
		this.setState({ emojiPicker: !this.state.emojiPicker });
	};

	handleAddEmoji = emoji => {
		const oldMessage = this.state.message;
		const newMessage = this.colonToUnicode(` ${oldMessage} ${emoji.colons} `);
		this.setState({ message: newMessage, emojiPicker: false });
		setTimeout(() => this.messageInputRef.focus(), 0);
	};

	colonToUnicode = message => {
		return message.replace(/:[A-Za-z0-9_+-]+:/g, x => {
			x = x.replace(/:/g, '');
			let emoji = emojiIndex.emojis[x];
			if (typeof emoji !== 'undefined') {
				let unicode = emoji.native;
				if (typeof unicode !== 'undefined') {
					return unicode;
				}
			}
			x = ':' + x + ':';
			return x;
		});
	};

	handleChange = event => {
		this.setState({
			[event.target.name]: event.target.value
		});
	};

	handleKeyDown = event => {
		if (event.ctrlKey && event.keyCode === 13) {
			this.sendMessage();
		}

		const { message, typingRef, channel, user } = this.state;

		if (message) {
			typingRef
				.child(channel.id)
				.child(user.uid)
				.set(user.displayName);
		} else {
			typingRef
				.child(channel.id)
				.child(user.uid)
				.remove();
		}
	};

	createMassage = (fileURL = null) => {
		const message = {
			timestamp: firebase.database.ServerValue.TIMESTAMP,
			user: {
				id: this.state.user.uid,
				name: this.state.user.displayName,
				avatar: this.state.user.photoURL
			}
		};

		if (fileURL !== null) {
			message['image'] = fileURL;
		} else {
			message['content'] = this.state.message;
		}

		return message;
	};

	sendMessage = () => {
		const { getMessagesRef } = this.props;
		const { message, channel, user, typingRef } = this.state;

		if (message) {
			this.setState({
				loading: true
			});
			getMessagesRef()
				.child(channel.id)
				.push()
				.set(this.createMassage())
				.then(() => {
					this.setState({
						loading: false,
						message: '',
						errors: []
					});

					typingRef
						.child(channel.id)
						.child(user.uid)
						.remove();
				})
				.catch(err => {
					console.error(err);
					this.setState({
						loading: false,
						errors: this.state.errors.concat(err)
					});
				});
		} else {
			this.setState({
				errors: this.state.errors.concat({
					message: 'Add a message'
				})
			});
		}
	};

	getPath = () => {
		if (this.props.isPrivateChannel) {
			return `chat/private-${this.state.channel.id}`;
		} else {
			return 'chat/public';
		}
	};

	uploadFile = (file, metadata) => {
		const pathToUpload = this.state.channel.id;
		const ref = this.props.getMessagesRef();
		const filePath = `${this.getPath()}/${uuidv4()}.jpg`;

		this.setState(
			{
				uploadState: 'uploading',
				uploadTask: this.state.storageRef.child(filePath).put(file, metadata)
			},
			() => {
				this.state.uploadTask.on(
					'state_changed',
					snap => {
						const percentageUploaded = Math.round(
							(snap.bytesTransferred / snap.totalBytes) * 100
						);
						this.setState({
							percentageUploaded
						});
					},
					err => {
						console.error(err);
						this.setState({
							errors: this.state.errors.concat(err),
							uploadState: 'error',
							uploadTask: null
						});
					},
					() => {
						this.state.uploadTask.snapshot.ref
							.getDownloadURL()
							.then(downloadURL => {
								console.log(downloadURL);
								this.sendFileMessage(downloadURL, ref, pathToUpload);
							})
							.catch(err => {
								console.error(err);
								this.setState({
									errors: this.state.errors.concat(err),
									uploadState: 'error',
									uploadTask: null
								});
							});
					}
				);
			}
		);

		console.log(this.state.uploadTask);
	};

	sendFileMessage = (fileURL, ref, pathToUpload) => {
		ref
			.child(pathToUpload)
			.push()
			.set(this.createMassage(fileURL))
			.then(() => {
				this.setState({ uploadState: 'done' });
			})
			.catch(err => {
				console.error(err);
				this.setState({
					errors: this.state.errors.concat(err)
				});
			});
	};

	render() {
		const {
			errors,
			message,
			loading,
			modal,
			uploadState,
			percentageUploaded,
			emojiPicker
		} = this.state;
		return (
			<Segment className='message__form'>
				{emojiPicker && (
					<Picker
						set='apple'
						onSelect={this.handleAddEmoji}
						className='emojipicker'
						title='Pick your emoji'
						emoji='point_up'
					/>
				)}
				<Input
					fluid
					name='message'
					style={{ marginBottom: '0.7em' }}
					value={message}
					label={
						<Button
							icon={emojiPicker ? 'close' : 'add'}
							content={emojiPicker ? 'Close' : null}
							onClick={this.handleTogglePicker}
						/>
					}
					ref={node => (this.messageInputRef = node)}
					labelPosition='left'
					placeholder='Write your message'
					className={
						errors.some(error => error.message.includes('message'))
							? 'error'
							: ''
					}
					onChange={this.handleChange}
					onKeyDown={this.handleKeyDown}
				/>

				<Button.Group icon widths='2'>
					<Button
						color='orange'
						disabled={loading}
						content='Add Reply'
						labelPosition='left'
						icon='edit'
						onClick={this.sendMessage}
					/>
					<Button
						color='teal'
						content='Upload Media'
						labelPosition='right'
						icon='cloud upload'
						disabled={uploadState === 'uploading'}
						onClick={this.openModal}
					/>
				</Button.Group>

				<FileModal
					modal={modal}
					closeModal={this.closeModal}
					uploadFile={this.uploadFile}
				/>
				<ProgressBar
					uploadState={uploadState}
					percentageUploaded={percentageUploaded}
				/>
			</Segment>
		);
	}
}

export default MessageForm;
