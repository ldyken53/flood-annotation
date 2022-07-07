import React from 'react';
import {Form, Button} from "react-bootstrap";
import Collapsible from 'react-collapsible';

type SidebarProps = {
  toggleTerrainLayer: () => void,
}
class Sidebar extends React.Component<SidebarProps, {}> {
    constructor(props) {
      super(props);
      this.state = {
      };
  
      this.handleSubmit = this.handleSubmit.bind(this);
    }
  
    handleSubmit(event) {
      event.preventDefault();
    }

  
    render() {
      return (
        <div className="sidebar"> 
        <Form style={{color: 'white'}} onSubmit={this.handleSubmit}>
          {/* <Form.Group controlId="formFile" className="mt-3 mb-3">
            <Form.Check defaultChecked={false} onClick={() => this.setState({jsonFormat: !this.state.jsonFormat})} type="checkbox" label="Json Format"></Form.Check>
            <Form.Label>Select Example Files</Form.Label>
            <Form.Control className="form-control" type="file" multiple onChange={(e) => {if (this.state.jsonFormat) {this.readJson(e as React.ChangeEvent<HTMLInputElement>)} else {this.readFiles(e as React.ChangeEvent<HTMLInputElement>)}}}/>
            <Button className="mt-2" type="submit" variant="secondary" value="Submit">Submit</ Button>
          </Form.Group> */}
          <Collapsible trigger="Layers"> 
            <Form.Check defaultChecked={true} onClick={(e) => this.props.toggleTerrainLayer()} type="checkbox" label="Terrain Layer"/>
          </Collapsible>
        </Form>
        </ div>
      );
    }
  }

export default Sidebar;