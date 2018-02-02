import React, { Component } from 'react'
import './Calls.css'
import {
	Form, FormGroup, Label, Button, ButtonGroup, Col, Input
} from 'reactstrap';

class Calls extends Component {
	constructor(props) {
		super(props);

		this.state = {
			status: 1,
			limit: 100,
			offset: 0,
			calls: [],
		};
	}

	async filter() {
		const res = await fetch(`/calls?status=${this.state.status}&limit=${this.state.limit}&offset=${this.state.offset}`)
		if (res.status === 200) {
			const body = await res.json()
			this.setState({ calls: body })
		} else if (res.status === 400) {
			throw new Error('Invalid filter arguments')
		} else {
			throw new Error('An unexpected error occurred')
		}
	}

	handleFilter(e) {
		this.filter().catch(err => alert(err.message))
	}

	callsRows(calls) {
		if (this.state.calls.length === 0) {
			return (
				<tr>
					<td colSpan="4" style={{ textAlign: "center" }}>No items right now, hit the Filter button.</td>
				</tr>
			)
		}
		return this.state.calls.map(call =>
			<tr key={call.callId}>
				<th scope="row">{call.callId}</th>
				<td>{call.number}</td>
				<td>{call.createdAt}</td>
				<td>{call.updatedAt}</td>
			</tr>
		)
	}

	componentDidMount() {
		this.filter().catch(err => alert(err.message))
	}

	render() {
		return (
			<div>
				<Form onSubmit={this.handleSubmit}>
					<FormGroup row>
						<Col>
							<Label sm={2}>Status</Label>
							<Col sm={10}>
								<ButtonGroup>
									<Button color="primary" onClick={() => this.setState({ status: 0 })} active={this.state.status === 0}>Waiting</Button>
									<Button color="primary" onClick={() => this.setState({ status: 1 })} active={this.state.status === 1}>Active</Button>
									<Button color="primary" onClick={() => this.setState({ status: 2 })} active={this.state.status === 2}>Completed</Button>
								</ButtonGroup>
							</Col>
						</Col>
						<Col>
							<Label sm={2}>Limit</Label>
							<Col sm={10}>
								<Input type="number" value={this.state.limit} onChange={e => this.setState({ limit: parseInt(e.target.value) })} />
							</Col>
						</Col>
						<Col>
							<Label sm={2}>Offset</Label>
							<Col sm={10}>
								<Input type="number" value={this.state.offset} onChange={e => this.setState({ offset: parseInt(e.target.value) })} />
							</Col>
						</Col>
						<Col className="btn-filter-parent">
							<Button type="button" color="primary" sm={2} className="btn-filter" onClick={e => this.handleFilter(e)}>Filter</Button>
						</Col>
					</FormGroup>
				</Form>
				<table className="table table-hover">
					<thead>
						<tr>
							<th scope="col">#</th>
							<th scope="col">Contact Number</th>
							<th scope="col">Called At</th>
							<th scope="col">Updated At</th>
						</tr>
					</thead>
					<tbody>
						{this.callsRows(this.state.calls)}
					</tbody>
				</table>
			</div>
		)
	}
}

export default Calls