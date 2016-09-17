import { Component, PropTypes, Children } from 'react'
import StyduxShape from './StyduxShape'


export default class StyduxProvider extends Component {

  static propTypes = {
    stydux: StyduxShape.isRequired,
    children: PropTypes.element
  }

  static childContextTypes = {
    stydux: StyduxShape.isRequired
  }

  constructor(props, context) {
    super(props, context)
    this.stydux = props.stydux
  }

  getChildContext() {
    return { stydux: this.stydux }
  }

  render() {
    return this.props.children ? Children.only(this.props.children) : null
  }
}
