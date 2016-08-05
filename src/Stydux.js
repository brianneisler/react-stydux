import { Component, PropTypes, Children } from 'react'
import StyduxShape from './StyduxShape'


export default class Stydux extends Component {

  static propTypes = {
    stydux: StyduxShape.isRequired,
    children: PropTypes.element.isRequired
  };

  static childContextTypes = {
    store: StyduxShape.isRequired
  };

  constructor(props, context) {
    super(props, context)
    this.stydux = props.stydux
  }

  getChildContext() {
    return { stydux: this.stydux }
  }

  render() {
    return Children.only(this.props.children)
  }
}
