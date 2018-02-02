import React, { Component } from 'react'
import './components/Calls'
import { Navbar, NavbarBrand } from 'reactstrap';
import Calls from './components/Calls';

class App extends Component {
	constructor(props) {
		super(props);

		this.toggle = this.toggle.bind(this);
		this.state = {
			isOpen: false
		};
	}
	toggle() {
		this.setState({
			isOpen: !this.state.isOpen
		});
	}
	render() {
		return (
			<div className="container">
				<Navbar expand="md" light>
					<NavbarBrand href="/">Dashboard</NavbarBrand>
				</Navbar>
				<Calls />
			</div>
		)
	}
}

export default App