export const sleep = (time: number) => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, time)
  })
}

export const messageUtility = {
  sendText: async (...args: any[]) => {
    console.log('####### messageUtility.sendText', args)
  },
  sendEmail: async (args: { address: string, title: string, body: string }) => {
    console.log('####### messageUtility.sendEmail', args)
  }
}

export const isPhone = (text: string): Boolean => {
  return !!text.length && text.split('').every(char => !isNaN(Number(char)))
}

export const isEmail = (text: string): Boolean => {
 const reg = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
 return reg.test(text)
}
