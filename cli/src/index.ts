export function main(argv = process.argv.slice(2)) {
  if (argv[0] === 'setup') {
    console.log('ov setup: not implemented yet')
    return
  }

  console.log('ov: hello')
}

main()
