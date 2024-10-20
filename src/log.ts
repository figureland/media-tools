type LogOptions = {
  message: string[]
  indent?: number
  color?: string
}

export const log = ({ message, indent = 2, color = 'grey' }: LogOptions) => {
  const indentation = ' '.repeat(indent)
  const colorCode = getColorCode(color)

  message.forEach((m) => {
    console.log(`\x1b[${colorCode}${indentation}${m}\x1b[0m`)
  })
}

export const error = (args: LogOptions) => log({ color: 'red', ...args })

const getColorCode = (color: string): string => {
  const colors: { [key: string]: string } = {
    black: '30m',
    red: '31m',
    green: '32m',
    yellow: '33m',
    blue: '34m',
    magenta: '35m',
    cyan: '36m',
    white: '37m',
    grey: '90m',
    orange: '38;5;208m',
    'lime green': '38;5;10m',
    'forest green': '38;5;28m'
  }

  return colors[color.toLowerCase()] || '37m'
}

export const print = {
  error,
  log
}

export const logo = `
-   -   -   -   -   -

F   I   G   U   R   E

-   -   -   -   -   -
`
