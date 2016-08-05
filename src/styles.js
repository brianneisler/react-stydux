import _ from 'mudash'
import hoistStatics from 'hoist-non-react-statics'
import invariant from 'invariant'
import { Component, createElement } from 'react'
import StyduxShape from './StyduxShape'
import warning from './warning'


const defaultMapStateToStyles = styles => ({}) // eslint-disable-line no-unused-vars
const defaultMergeStyles = (defaultStyles, mappedStyles, inlineStyles) => _.merge(
  {},
  defaultStyles,
  mappedStyles,
  inlineStyles
)

function getDisplayName(WrappedComponent) {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component'
}

const errorObject = { value: null }
function tryCatch(fn, ctx) {
  try {
    return fn.apply(ctx)
  } catch (err) {
    errorObject.value = err
    return errorObject
  }
}

// Helps track hot reloading.
let nextVersion = 0

export default function _styles(mapStateToStyles, mergeStyles, options = {}) {
  const shouldSubscribe = Boolean(mapStateToStyles)
  const mapStateStyles = mapStateToStyles || defaultMapStateToStyles
  const finalMergeStyles = mergeStyles || defaultMergeStyles
  const { pure = true, withRef = false } = options
  const checkMergedEquals = pure && finalMergeStyles !== defaultMergeStyles

  // Helps track hot reloading.
  const version = nextVersion++

  return function wrapWithStydux(WrappedComponent) {
    const styduxDisplayName = `Stydux(${getDisplayName(WrappedComponent)})`

    function checkStylesShape(styles, methodName) {
      if (!_.isPlainObject(styles)) {
        warning(
          `${methodName}() in ${styduxDisplayName} must return a plain object. ` +
          `Instead received ${styles}.`
        )
      }
    }

    function computeMergedStyles(defaultStyles, mappedStyles, inlineStyles, props) {
      const mergedStyles = finalMergeStyles(defaultStyles, mappedStyles, inlineStyles, props)
      if (process.env.NODE_ENV !== 'production') {
        checkStylesShape(mergedStyles, 'mergedStyles')
      }
      return mergedStyles
    }

    class StyduxComponent extends Component {

      shouldComponentUpdate() {
        return !pure || this.haveOwnPropsChanged || this.hasStateStylesChanged
      }

      constructor(props, context) {
        super(props, context)
        this.version = version
        this.stydux = props.stydux || context.stydux
        this.defaultStyles = WrappedComponent.defaultStyles || {}
        this.handleChange = this.handleChange.bind(this)
        this.state = {}

        invariant(this.theme,
          'Could not find "stydux" in either the context or ' +
          `props of "${styduxDisplayName}". ` +
          'Either wrap the root component in a <Stydux>, ' +
          `or explicitly pass "theme" as a prop to "${styduxDisplayName}".`
        )

        this.clearCache()
      }

      computeMappedStyles(stateStyles, props) {
        if (!this.finalMapStateToStyles) {
          return this.configureFinalMapStyles(stateStyles)
        }

        const mappedStyles = this.doMappedStylesDependOnOwnProps ?
          this.finalMapStateToStyles(stateStyles, props) :
          this.finalMapStateToStyles(stateStyles)

        if (process.env.NODE_ENV !== 'production') {
          checkStylesShape(mappedStyles, 'mapStateToStyles')
        }
        return mappedStyles
      }

      configureFinalMapStyles(stateStyles, props) {
        const mappedStyles = mapStateStyles(stateStyles)
        const isFactory = typeof mappedStyles === 'function'

        this.finalMapStateToStyles = isFactory ? mappedStyles : mapStateStyles
        this.doMappedStylesDependOnOwnProps = this.finalMapStateToStyles.length !== 1

        if (isFactory) {
          return this.computeMappedStyles(stateStyles, props)
        }

        if (process.env.NODE_ENV !== 'production') {
          checkStylesShape(mappedStyles, 'mapStateToStyles')
        }
        return mappedStyles
      }

      updateMappedStylesIfNeeded() {
        const nextMappedStyles = this.computeMappedStyles(this.stydux.getStyles(), this.props)
        if (this.mappedStyles && _.isEqual(nextMappedStyles, this.mappedStyles)) {
          return false
        }

        this.mappedStyles = nextMappedStyles
        return true
      }

      updateMergedStylesIfNeeded() {
        const inlineStyles = this.props ? this.props.styles : {}
        const nextMergedStyles = computeMergedStyles(this.defaultStyles, this.mappedStyles, inlineStyles, this.props)
        if (this.mergedStyles && checkMergedEquals && _.isEqual(nextMergedStyles, this.mergedStyles)) {
          return false
        }

        this.mergedStyles = nextMergedStyles
        return true
      }

      isSubscribed() {
        return this.subscribed
      }

      trySubscribe() {
        if (shouldSubscribe && !this.subscribed) {
          this.subscribed = true
          this.stydux.onChange(this.handleChange)
          this.handleChange()
        }
      }

      tryUnsubscribe() {
        if (this.subscribed) {
          this.stydux.offChange(this.handleChange)
          this.subscribed = false
        }
      }

      componentDidMount() {
        this.trySubscribe()
      }

      componentWillReceiveProps(nextProps) {
        if (!pure || !_.isEqual(nextProps, this.props)) {
          this.haveOwnPropsChanged = true
        }
      }

      componentWillUnmount() {
        this.tryUnsubscribe()
        this.clearCache()
      }

      clearCache() {
        this.mergedStyles = null
        this.haveOwnPropsChanged = true
        this.hasStateStylesChanged = true
        this.haveMappedStylesBeenPrecalculated = false
        this.mappedStylesPrecalculationError = null
        this.renderedElement = null
        this.finalMapStateToStyles = null
      }

      handleChange() {
        if (!this.subscribed) {
          return
        }

        const styles = this.stydux.getStyles()
        const prevStyles = this.state.styles
        if (pure && prevStyles === styles) {
          return
        }

        if (pure && !this.doMappedStylesDependOnOwnProps) {
          const haveMappedStylesChanged = tryCatch(this.updateMappedStylesIfNeeded, this)
          if (!haveMappedStylesChanged) {
            return
          }
          if (haveMappedStylesChanged === errorObject) {
            this.mappedStylesPrecalculationError = errorObject.value
          }
          this.haveMappedStylesBeenPrecalculated = true
        }

        this.hasStateStylesChanged = true
        this.setState({ styles })
      }

      getWrappedInstance() {
        invariant(withRef,
          'To access the wrapped instance, you need to specify ' +
          '{ withRef: true } as the third argument of the stydux() call.'
        )

        return this.refs.wrappedInstance
      }

      render() {
        const {
          haveOwnPropsChanged,
          hasStateStylesChanged,
          haveMappedStylesBeenPrecalculated,
          mappedStylesPrecalculationError,
          renderedElement
        } = this

        this.haveOwnPropsChanged = false
        this.hasStateStylesChanged = false
        this.haveMappedStylesBeenPrecalculated = false
        this.mappedStylesPrecalculationError = null

        if (mappedStylesPrecalculationError) {
          throw mappedStylesPrecalculationError
        }

        let shouldUpdateMappedStyles = true
        if (pure && renderedElement) {
          shouldUpdateMappedStyles = hasStateStylesChanged || (
            haveOwnPropsChanged && this.doMappedStylesDependOnOwnProps
          )
        }

        let haveMappedStylesChanged = false
        if (haveMappedStylesBeenPrecalculated) {
          haveMappedStylesChanged = true
        } else if (shouldUpdateMappedStyles) {
          haveMappedStylesChanged = this.updateMappedStylesIfNeeded()
        }

        let haveMergedStylesChanged = true
        if (
          haveMappedStylesChanged ||
          haveOwnPropsChanged
        ) {
          haveMergedStylesChanged = this.updateMergedStylesIfNeeded()
        } else {
          haveMergedStylesChanged = false
        }

        if (!haveMergedStylesChanged && renderedElement) {
          return renderedElement
        }

        if (withRef) {
          this.renderedElement = createElement(WrappedComponent, {
            ...this.props,
            styles: this.mergedStyles,
            ref: 'wrappedInstance'
          })
        } else {
          this.renderedElement = createElement(WrappedComponent, {
            ...this.props,
            styles: this.mergedStyles
          })
        }

        return this.renderedElement
      }
    }

    StyduxComponent.displayName = styduxDisplayName
    StyduxComponent.WrappedComponent = WrappedComponent
    StyduxComponent.contextTypes = {
      stydux: StyduxShape
    }
    StyduxComponent.propTypes = {
      stydux: StyduxShape
    }

    if (process.env.NODE_ENV !== 'production') {
      StyduxComponent.prototype.componentWillUpdate = function componentWillUpdate() {
        if (this.version === version) {
          return
        }

        // We are hot reloading!
        this.version = version
        this.clearCache()
      }
    }

    return hoistStatics(StyduxComponent, WrappedComponent)
  }
}
