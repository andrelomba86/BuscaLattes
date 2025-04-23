// ==UserScript==
// @name         Lattes Extractor
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Extract information from Lattes CV
// @author       GitHub Copilot
// @match        *://*.lattes.cnpq.br/*
// @grant        none
// ==/UserScript==

;(function () {
  'use strict'

  function extractLattesInfo() {
    const name = document.querySelector('h2.nome').innerText
    const productions = Array.from(document.querySelectorAll('.artigo-completo')).map(el => el.innerText)
    const congressParticipations = Array.from(document.querySelectorAll('.participacao-congresso')).map(
      el => el.innerText
    )
    const boardParticipations = Array.from(document.querySelectorAll('.participacao-banca')).map(
      el => el.innerText
    )

    const lattesInfo = {
      name,
      productions,
      congressParticipations,
      boardParticipations,
    }

    console.log(lattesInfo)
  }

  window.addEventListener('load', extractLattesInfo)
})()
