import React, { Component } from 'react';
import firebase from '../../firebase';
import uuidv4 from 'uuid/v4';
import { Segment, Button, Input } from 'semantic-ui-react';

import FileModal from './FileModal';
import ProgressBar from './ProgressBar';

class MessageForm extends Component {
	state = {
		storageRef: firebase.storage().ref(),
		uploadTask: null,
		uploadState: '',
		percentageUploaded: 0,
		message: '',
		loading: false,
		user: this.props.currentUser,
		channel: this.props.currentChannel,
		errors: [],
		modal: false
	};

	openModal = () => this.setState({ modal: true });

	closeModal = () => this.setState({ modal: false });

	handleChange = event => {
		this.setState({
			[event.target.name]: event.target.value
		});
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
		const { messagesRef } = this.props;
		const { message, channel } = this.state;

		if (message) {
			this.setState({
				loading: true
			});
			messagesRef
				.child(channel.id)
				.push()
				.set(this.createMassage())
				.then(() => {
					this.setState({
						loading: false,
						message: '',
						errors: []
					});
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

	uploadFile = (file, metadata) => {
		const pathToUpload = this.state.channel.id;
		const ref = this.props.messagesRef;
		const filePath = `chat/public/${uuidv4().jpg}`;

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
			percentageUploaded
		} = this.state;
		return (
			<Segment className='message__form'>
				<Input
					fluid
					name='message'
					style={{ marginBottom: '0.7em' }}
					value={message}
					label={<Button icon={'add'} />}
					labelPosition='left'
					placeholder='Write your message'
					className={
						errors.some(error => error.message.includes('message'))
							? 'error'
							: ''
					}
					onChange={this.handleChange}
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
