export default defineAppConfig({
  ui: {
    colors: {
      primary: 'iris',
      secondary: 'amber',
      success: 'teal',
      neutral: 'slate'
    },
    button: {
      slots: {
        base: 'rounded-[5px]'
      },
      defaultVariants: {
        size: 'sm'
      }
    },
    input: {
      slots: {
        base: 'rounded-[5px]'
      },
      defaultVariants: {
        size: 'sm'
      }
    },
    select: {
      slots: {
        base: 'rounded-[5px]'
      },
      defaultVariants: {
        size: 'sm'
      }
    },
    textarea: {
      slots: {
        base: 'rounded-[5px]'
      }
    },
    modal: {
      slots: {
        content: 'border border-default'
      }
    }
  }
})
