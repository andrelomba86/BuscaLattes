const puppeteer = require('puppeteer')
const fs = require('fs')

async function downloadLattes(id) {
  const browser = await puppeteer.launch({ headless: false })
  const page = await browser.newPage()

  // Definir headers e cookies
  await page.setExtraHTTPHeaders({
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
  })

  const cookies = [
    // Adicione seus cookies aqui
    // { name: 'cookie_name', value: 'cookie_value', domain: 'buscatextual.cnpq.br' }
  ]
  await page.setCookie(...cookies)

  // Navegar para a página do Lattes
  await page.goto(`http://buscatextual.cnpq.br/buscatextual/visualizacv.do?id=${id}`)

  // Esperar o usuário resolver o captcha
  await page.waitForSelector('#captchaImage', { visible: true })
  console.log('Por favor, resolva o captcha exibido no navegador.')
  await page.waitForSelector('#captchaImage', { hidden: true })

  // Baixar o currículo
  const downloadButtonSelector = 'a[href*="baixarcurriculo"]'
  await page.waitForSelector(downloadButtonSelector)
  const downloadUrl = await page.$eval(downloadButtonSelector, el => el.href)

  const viewSource = await page.goto(downloadUrl)
  fs.writeFileSync('curriculo.pdf', await viewSource.buffer())

  await browser.close()
  console.log('Currículo baixado com sucesso!')
}

downloadLattes('1333845337012256')
