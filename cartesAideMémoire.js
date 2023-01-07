"use strict";

/* Constantes et stylesheet pour controller les couleurs et le font */
const couleurFondDéfaut='adfadf'
const couleurQuestionDéfaut='8fbf00'
const couleurRéponseDéfaut='ffbf00'

const fontURLDeBase='https://fonts.googleapis.com/css2?family='
const fontDéfaut='Roboto'
var stylesheetFont=document.createElement('link')
stylesheetFont.rel="stylesheet"
stylesheetFont.href=fontURLDeBase+encodeURIComponent(fontDéfaut)
document.head.append(stylesheetFont)

var stylesheetDynamique=document.createElement('style')
document.head.appendChild(stylesheetDynamique)
stylesheetDynamique.sheet.insertRule("body { background-color: #"+couleurFondDéfaut+"; }",0)
stylesheetDynamique.sheet.insertRule(".question { background-color: #"+couleurQuestionDéfaut+"; }",0)
stylesheetDynamique.sheet.insertRule(".réponse { background-color: #"+couleurRéponseDéfaut+"; }",0)
stylesheetDynamique.sheet.insertRule(".textePrincipale { font-family: '"+fontDéfaut+"'; }",0)

/* Modèle */

/* La collection d'ensembles de cartes.  Chaque membre contient:
    - titre - Le nom de l'ensemble de cartes
    - description - Une description de l'ensemble de cartes
    - font - Le nom du font Google utilisé pour les questions et réponses
    - couleurFond - Couleur de fond (6 charactères hexadécimaux)
    - couleurQuestion - Couleur pour le fond de la carte, côté question
    - couleurRéponse - Couleur pour le fond de la carte, côté réponse
    - questions - la liste de questions et réponses; chaque membre est une structure qui contient:
        - question - Le texte de la question
        - réponse - Le texte de la réponse
        - questionEstURL - Vrai si question contient un URL d'une image plutôt que du texte
        - réponseEstURL - Vrai si la réponse contient un URL d'une image plutôt que du texte */
var collection=[]

var nombreDeRépétitions=3 // Le nombre de fois qu'il faut demander chaque question, chaque ronde

const MODE_EN_ORDRE=0 // Poser les questions en ordre
const MODE_AU_HAZARD=1 // Choisir les questions au hazard
var mode=MODE_EN_ORDRE // Un de MODE_EN_ORDRE, MODE_AU_HAZARD

/* Contient:
  - questions - liste d'informations au sujet de chaque question.  La
                question choisie est la première et va à la fin de la liste de questions
                restantes quand une réponse est donnée.  Pour chaque question, contient:
     - collection - index de l'ensemble de cartes dans la collection
     - index - index de la carte dans l'ensemble de cartes
     - nombreJustes - nombre de fois qu'on a donné une réponse juste pour cette carte
     - nombreDErreurs - nombre de fois qu'on a donné une réponse fausse pour cette carte
  - questionsRestantes - le nombre de questions restant à poser.  Elles sont premières
       dans la liste.
  - nombreJustes - nombre de fois qu'on a donné une réponse juste en tout
  - nombreDErreurs - nombre de fois qu'on a donné une réponse fausse, en tout
  Undefined indique qu'aucune ronde n'a été commencée. */
var étatDeRonde=undefined

var étatGlobal={
    nombreJustes: 0, // Le nombre de réponses justes
    nombreDErreurs: 0, // Le nombre de réponses incorrectes
    rondesFaites: 0 // Le nombre de fois que toutes les questions ont été acceptées
}

/* Une liste de boolean indiquant si les cartes de l'ensemble correspondant
 * devraient être montrées */
var ensembleActif=[]

/* l'index dans la collection de l'ensemble de cartes à modifier dans l'éditeur */
var ensembleÀÉditer

/* Constantes correspondant aux vues du programme */
const VUE_CONFIGURATION=0
const VUE_QUESTION=1
const VUE_RÉPONSE=2
const VUE_ÉDITEUR=3

var vue=VUE_CONFIGURATION // Le partie de l'interface à monter

/* Ouvre un document JSON et l'ajoute à la collection. La fonction
   callback est appelée quand le document est lu. Deux formats sont
   utilisés:
     - Une collection (un Array)
     - Un ensemble de cartes (un objet)
*/
function ouvrirDocument(leDocument,callback) {
    var fileReader=new FileReader()
    fileReader.addEventListener("load",(event)=>{
	try {
	    var cartes=JSON.parse(fileReader.result)
	    if (!Array.isArray(cartes)) {
		// Transformer l'ensemble à une collection contenant un ensemble
		cartes=[cartes]
	    }
	    collection=collection.concat(cartes)
	    for (var i=0;i<cartes.length;i++) {
		ensembleActif.push(true)
	    }
	    callback()
	} catch (e) {
	    alert(e)
	}
    })
    fileReader.readAsText(leDocument)
}

/* Initialize étatDeRonde et choisis la première carte.  Rend true s'il n'y
   a pas de cartes dans la collection */
function initializerLaRonde() {
    étatDeRonde={}
    étatDeRonde.questions=[]
    for (var indexEnsemble=0;indexEnsemble<collection.length;indexEnsemble++) {
	if (!ensembleActif[indexEnsemble]) {
	    continue
	}
	for (var i=0;i<collection[indexEnsemble].questions.length;i++) {
	    étatDeRonde.questions.push({
		collection: indexEnsemble,
		index: i,
		nombreJustes: 0,
		nombreDErreurs: 0
	    })
	}
    }
    étatDeRonde.questionsRestantes=étatDeRonde.questions.length
    étatDeRonde.nombreJustes=0
    étatDeRonde.nombreDErreurs=0
    if (étatDeRonde.questionsRestantes==0) {
	étatDeRonde=undefined
	return true
    }
    choisirUneNouvelleCarte(true)
    return false
}

/* Modifie l'état de ronde pour que la question à l'index 'de' soît à
 * l'index 'à'. L'index 'à' est relatif à la liste actuelle, ignorant
 * que l'index pourrait changer quand l'élément sera déplacé. */
function bougerQuestion(de, à) {
    if (de!=à) {
	var laQuestion=étatDeRonde.questions[de]
	étatDeRonde.questions.splice(de,1)
	if (de<à) {
	    à--
	}
	étatDeRonde.questions.splice(à,0,laQuestion)
    }
}

/* Choisis la prochaine carte; début indique que c'est le début d'une ronde */
function choisirUneNouvelleCarte(début) {
    var prochaineQuestion=0
    if (mode==MODE_AU_HAZARD) {
	if (étatDeRonde.questionsRestantes>1) {
	    if (début) {
		prochaineQuestion=Math.floor(Math.random()*étatDeRonde.questionsRestantes)
	    } else {
		// la question à la fin est celle la plus récemment montrée; ne choisissons pas celle là
		prochaineQuestion=Math.floor(Math.random()*(étatDeRonde.questionsRestantes-1))
	    }
	}
    } else {
	// sinon, la première question est la bonne
    }
    // mettre la question choisie au début
    bougerQuestion(prochaineQuestion,0)
}

/* Va à la prochaine question après une réponse juste.  Rend true si une nouvelle ronde doit commencer, false autrement. */
function réponseJuste() {
    étatDeRonde.questions[0].nombreJustes++
    étatDeRonde.nombreJustes++
    étatGlobal.nombreJustes++
    if (étatDeRonde.questions[0].nombreJustes>=nombreDeRépétitions) {
	bougerQuestion(0,étatDeRonde.questions.length)
	étatDeRonde.questionsRestantes--
	if (étatDeRonde.questionsRestantes==0) {
	    étatGlobal.rondesFaites++
	    return true
	}
    } else {
	bougerQuestion(0,étatDeRonde.questionsRestantes)
    }
    choisirUneNouvelleCarte(false)
    return false
}

/* Va à la prochaine question après une réponse fausse */
function réponseFausse() {
    étatDeRonde.questions[0].nombreDErreurs++
    étatDeRonde.nombreDErreurs++
    étatGlobal.nombreDErreurs++
    bougerQuestion(0,étatDeRonde.questionsRestantes)
    choisirUneNouvelleCarte(false)
}

function passerLaQuestion() {
    bougerQuestion(0,étatDeRonde.questionsRestantes)
    choisirUneNouvelleCarte(false)
}

function effacerEnsemble(index) {
    collection.splice(index,1)
    ensembleActif.splice(index,1)
}

/* Controlleurs - commun */

/* Vérifie la syntaxe de la couleur désirée.  Rend désirée si elle est juste, sinon défaut */
function couleur(désirée, défaut) {
    if (désirée.length!=6) {
	return défaut
    }
    for (var i=0;i<6;i++) {
	if (!(désirée[i]>='0' && désirée[i]<='9') && !(désirée[i]>='a' && désirée[i]<='f') && !(désirée[i]>='A' && désirée[i]<='F')) {
	    return défaut
	}
    }
    return désirée
}

/* Vérifie la syntaxe du font désiré.  Rend désiré si elle est juste, sinon défaut */
function fontDésiré(désiré, défaut) {
    if (désiré=='') {
	return défaut
    }
    for (var i=0;i<désiré.length;i++) {
	if (!(désiré[i]>='a' && désiré[i]<='z') && !(désiré[i]>='A' && désiré[i]<='Z') && !(désiré[i]>='0' && désiré[i]<='9') && !désiré[i]==' ') {
	    return défaut
	}
    }
    return désiré
}

function cacherToutesLesVues() {
    divQuestion.classList.add('hidden')
    divRéponse.classList.add('hidden')
    divConfiguration.classList.add('hidden')
    divÉditeur.classList.add('hidden')
}

function miseÀJour() {
    var couleurFond
    var couleurQuestion
    var couleurRéponse
    var font

    if (étatDeRonde==undefined || vue==VUE_CONFIGURATION || vue==VUE_ÉDITEUR) {
	couleurFond=couleurFondDéfaut
	couleurQuestion=couleurQuestionDéfaut
	couleurRéponse=couleurRéponseDéfaut
	font=fontDéfaut
    } else {
	var question=étatDeRonde.questions[0]
	var cartes=collection[question.collection]
	couleurFond=couleur(cartes.couleurFond,couleurFondDéfaut)
	couleurQuestion=couleur(cartes.couleurQuestion,couleurQuestionDéfaut)
	couleurRéponse=couleur(cartes.couleurRéponse,couleurRéponseDéfaut)
	font=fontDésiré(cartes.font,fontDéfaut)
    }
    
    stylesheetDynamique.sheet.deleteRule(0)
    stylesheetDynamique.sheet.deleteRule(0)
    stylesheetDynamique.sheet.deleteRule(0)
    stylesheetDynamique.sheet.deleteRule(0)
    stylesheetDynamique.sheet.insertRule("body { background-color: #"+couleurFond+"; }",0)
    stylesheetDynamique.sheet.insertRule(".question { background-color: #"+couleurQuestion+"; }",0)
    stylesheetDynamique.sheet.insertRule(".réponse { background-color: #"+couleurRéponse+"; }",0)
    stylesheetDynamique.sheet.insertRule(".textePrincipale { font-family: '"+font+"'; }",0)
    stylesheetFont.href=fontURLDeBase+encodeURIComponent(font)
    if (vue==VUE_CONFIGURATION) {
	miseÀJourVueConfiguration()
    } else if (vue==VUE_QUESTION) {
	miseÀJourVueQuestion()
    } else if (vue==VUE_RÉPONSE) {
	miseÀJourVueRéponse()
    } else if (vue==VUE_ÉDITEUR) {
	miseÀJourVueÉditeur()
    }
    mettreStatistiquesÀJour()
}

/* Vue et Controlleur configuration */
function montrerLaConfiguration() {
    cacherToutesLesVues()
    divConfiguration.classList.remove('hidden')
    vue=VUE_CONFIGURATION
    miseÀJour()
}

/* Rend true s'il y a une erreur de configuration */
function lireConfiguration() {
    try {
	nombreDeRépétitions=parseInt(inputNombreDeRépétitions.value)
    } catch (e) {
	alert(e)
	return true
    }
    if (inputChoisirAuHazard.checked) {
	mode=MODE_AU_HAZARD
    } else {
	mode=MODE_EN_ORDRE
    }
    var i=0
    for (var checkbox=divListeDEnsembles.firstChild;checkbox!=null;checkbox=checkbox.nextSibling) {
	ensembleActif[i]=checkbox.checked
	checkbox=checkbox.nextSibling
	i++
    }
}

function montrerLaProchaineQuestionRéponseJuste() {
    if (réponseJuste()) {
	alert("Ronde "+étatGlobal.rondesFaites+" finie - "+étatDeRonde.nombreDErreurs+" erreurs faites")
	initializerLaRonde()
    }
    montrerLaQuestion()
}

function montrerLaProchaineQuestionRéponseFausse() {
    réponseFausse()
    montrerLaQuestion()
}

/** vue configuration **/
boutonOuvrirDocument.addEventListener('click', () => {
    documentÀOuvrir.click()
})

boutonNouvelEnsemble.addEventListener('click', () => {
    lireConfiguration()
    ensembleÀÉditer=collection.length
    ensembleActif[collection.length]=true
    montrerÉditeur()
})

lienSauvegarderCollection.addEventListener('click',() => {
    lienSauvegarderCollection.href='data:application/octet-stream,'+encodeURIComponent(JSON.stringify(collection))
})

boutonCommencer.addEventListener("click",() => {
    if (lireConfiguration()) {
	return
    }
    if (initializerLaRonde()) {
	alert("Il n'y a pas de questions!")
	return
    }
    montrerLaQuestion()
})

documentÀOuvrir.addEventListener("change",() => {
    ouvrirDocument(documentÀOuvrir.files[0], miseÀJour)
})

function créerOuvreurDÉditeur(index) {
    return function (event) {
	lireConfiguration()
	ensembleÀÉditer=index
	montrerÉditeur()
	event.preventDefault()
    }
}

function miseÀJourVueConfiguration() {
    divListeDEnsembles.replaceChildren()
    for (var i=0;i<collection.length;i++) {
	var checkbox=document.createElement("input")
	checkbox.type="checkbox"
	if (ensembleActif[i]) {
	    checkbox.checked=true
	}
	divListeDEnsembles.appendChild(checkbox)
	var link=document.createElement("a")
	link.href="#"
	if ("description" in collection[i] && collection[i].description!="") {
	    link.title=collection[i].description
	}
	link.appendChild(document.createTextNode(collection[i].titre))
	link.addEventListener("click",créerOuvreurDÉditeur(i))
	divListeDEnsembles.appendChild(link)
    }
}

/* Vue et controlleurs question */
boutonQuestionSuivante.addEventListener("click", () => {
    passerLaQuestion()
    miseÀJour()
})

boutonVoireAutreFace.addEventListener("click",montrerLaRéponse)

boutonConfiguration_question.addEventListener('click', montrerLaConfiguration)

function montrerLaQuestion() {
    cacherToutesLesVues()
    divQuestion.classList.remove('hidden')
    vue=VUE_QUESTION
    miseÀJour()
}

function miseÀJourVueQuestion() {
    var question=étatDeRonde.questions[0]
    var carte=collection[question.collection].questions[question.index]
    if (carte.questionEstURL) {
	pQuestion.classList.add('hidden')
	imgQuestion.classList.remove('hidden')
	imgQuestion.src=carte.question
    } else {
	pQuestion.classList.remove('hidden')
	imgQuestion.classList.add('hidden')
	pQuestion.innerText=carte.question
    }
}

/* Vue et controlleurs réponse */
boutonRevoirLaQuestion.addEventListener('click',montrerLaQuestion)

boutonJuste.addEventListener('click',montrerLaProchaineQuestionRéponseJuste)

boutonRaté.addEventListener('click',montrerLaProchaineQuestionRéponseFausse)

boutonConfiguration_réponse.addEventListener('click', montrerLaConfiguration)

function montrerLaRéponse() {
    cacherToutesLesVues()
    divRéponse.classList.remove('hidden')
    vue=VUE_RÉPONSE
    miseÀJour()
}

function miseÀJourVueRéponse() {
    var question=étatDeRonde.questions[0]
    var carte=collection[question.collection].questions[question.index]
    if (carte.réponseEstURL) {
	pRéponse.classList.add('hidden')
	imgRéponse.classList.remove('hidden')
	imgRéponse.src=carte.réponse
    } else {
	pRéponse.classList.remove('hidden')
	imgRéponse.classList.add('hidden')
	pRéponse.innerText=carte.réponse
    }
}

/* Vue et controlleurs éditeur */

boutonRetourDeLÉditeur.addEventListener('click',retourDeLÉditeur)

lienSauvegarder.addEventListener('click',() => {
    générerListeDeCartes()
    lienSauvegarder.href='data:application/octet-stream,'+encodeURIComponent(JSON.stringify(collection[ensembleÀÉditer]))
})

boutonEffacer.addEventListener('click', () => {
    if (window.confirm("Effacer cet ensemble?")) {
	effacerEnsemble(ensembleÀÉditer)
	montrerLaConfiguration()
    }
})

function montrerÉditeur() {
    cacherToutesLesVues()
    divÉditeur.classList.remove('hidden')
    vue=VUE_ÉDITEUR
    miseÀJour()
}

function retourDeLÉditeur() {
    générerListeDeCartes()
    montrerLaConfiguration()
}

function générerListeDeCartes() {
    var cartes={}
    cartes.titre=inputÉditeurTitre.value
    cartes.description=taÉditeurDescription.value
    cartes.font=inputÉditeurFont.value
    cartes.couleurFond=inputÉditeurCouleurFond.value
    cartes.couleurQuestion=inputÉditeurCouleurQuestion.value
    cartes.couleurRéponse=inputÉditeurCouleurRéponse.value
    cartes.questions=[]

    // Lire toutes les questions, mais sauter pardessus les entêtes
    var prochainÉlément=divÉditeurQuestions.firstChild.nextSibling.nextSibling.nextSibling.nextSibling
    while (prochainÉlément!=null) {
	var question=prochainÉlément.value
	prochainÉlément=prochainÉlément.nextSibling

	var questionEstURL=prochainÉlément.firstChild.checked
	prochainÉlément=prochainÉlément.nextSibling

	var réponse=prochainÉlément.value
	prochainÉlément=prochainÉlément.nextSibling

	var réponseEstURL=prochainÉlément.firstChild.checked
	prochainÉlément=prochainÉlément.nextSibling

	cartes.questions.splice(cartes.questions.length,0,{
	    question:question,
	    réponse:réponse,
	    questionEstURL:questionEstURL,
	    réponseEstURL:réponseEstURL
	})
    }
    collection[ensembleÀÉditer]=cartes
}

/* Ajoute un éditeur texte contenant le texte spécifié et des boutons
 * après élément.  Rend le dernier élément ajouté. */
function créerÉditeurQuestionOuRéponseEtBoutons(élément, texte, estUnURL) {
    var ta=document.createElement("textarea")
    ta.appendChild(document.createTextNode(texte))
    élément.after(ta)
    élément=élément.nextSibling

    var divBoutons=document.createElement('div')
    var inputImage=document.createElement("input")
    inputImage.type="file"

    var checkboxEstURL=document.createElement("input")
    checkboxEstURL.type='checkbox'
    checkboxEstURL.checked=estUnURL
    divBoutons.appendChild(checkboxEstURL)
    divBoutons.appendChild(document.createTextNode("URL d'image"))
    divBoutons.appendChild(inputImage)

    inputImage.addEventListener('change',créerAjouteurDImage(inputImage, ta, checkboxEstURL))

    élément.after(divBoutons)
    élément=élément.nextSibling
    return élément
}

/* Ajouter une rangée pour une question dans la liste de l'éditeur.  Rend le dernier élément ajouté. */
function ajouterQuestion(élément, texteQuestion, questionEstURL, texteRéponse, réponseEstURL) {
    var prochainÉlément=créerÉditeurQuestionOuRéponseEtBoutons(élément, texteQuestion, questionEstURL)
    var taQuestion=élément.nextSibling
    élément=créerÉditeurQuestionOuRéponseEtBoutons(prochainÉlément, texteRéponse, réponseEstURL)

    var boutonAjouter=document.createElement("button")
    boutonAjouter.addEventListener('click', créerAjouteurDeQuestion(taQuestion))
    boutonAjouter.appendChild(document.createTextNode("+"))
    élément.appendChild(boutonAjouter)

    var boutonRetirer=document.createElement("button")
    boutonRetirer.addEventListener('click', créerEnleveurDeQuestion(taQuestion))
    boutonRetirer.appendChild(document.createTextNode("-"))
    élément.appendChild(boutonRetirer)
    return élément
}

function créerAjouteurDeQuestion(élémentQuestion) {
    return function() {
	ajouterQuestion(élémentQuestion.nextSibling.nextSibling.nextSibling,"",false,"",false)
    }
}

function créerEnleveurDeQuestion(élémentQuestion) {
    return function () {
	var élémentBoutonsQuestion=élémentQuestion.nextSibling
	var élémentRéponse=élémentBoutonsQuestion.nextSibling
	var élémentBoutonsRéponse=élémentRéponse.nextSibling
	élémentQuestion.remove()
	élémentBoutonsQuestion.remove()
	élémentRéponse.remove()
	élémentBoutonsRéponse.remove()
    }
}

function créerAjouteurDImage(élémentFile, élémentTexte,boîteÀCocher) {
    return function () {
	var fileObject=élémentFile.files[0]
	var fileReader=new FileReader()
	fileReader.addEventListener("load",(event)=>{
	    try {
		boîteÀCocher.checked=true
		élémentTexte.replaceChildren(document.createTextNode(fileReader.result))
	    } catch (e) {
		alert(e)
	    }
	})
	fileReader.readAsDataURL(fileObject)
    }
}

function miseÀJourVueÉditeur() {
    var cartes=collection[ensembleÀÉditer]
    inputÉditeurTitre.value=cartes!=undefined && 'titre' in cartes?cartes.titre:""
    taÉditeurDescription.value=cartes!=undefined && 'description' in cartes?cartes.description:""
    inputÉditeurFont.value=cartes!=undefined && 'font' in cartes?cartes.font:""
    inputÉditeurCouleurFond.value=cartes!=undefined && 'couleurFond' in cartes?cartes.couleurFond:""
    inputÉditeurCouleurQuestion.value=cartes!=undefined && 'couleurQuestion' in cartes?cartes.couleurQuestion:""
    inputÉditeurCouleurRéponse.value=cartes!=undefined && 'couleurRéponse' in cartes?cartes.couleurRéponse:""

    divÉditeurQuestions.replaceChildren()
    var labelQuestion=document.createElement('p')
    labelQuestion.classList.add("titreDeColonne")
    labelQuestion.appendChild(document.createTextNode("Question"))
    var labelVide=document.createElement('p')
    var labelRéponse=document.createElement('p')
    labelRéponse.classList.add("titreDeColonne")
    labelRéponse.appendChild(document.createTextNode("Réponse"))

    divÉditeurQuestions.appendChild(labelQuestion)
    divÉditeurQuestions.appendChild(labelVide)
    divÉditeurQuestions.appendChild(labelRéponse)
    var boutonAjouter=document.createElement("button")
    boutonAjouter.appendChild(document.createTextNode("+"))
    boutonAjouter.addEventListener('click', créerAjouteurDeQuestion(labelQuestion))
    var nextChild=divÉditeurQuestions.appendChild(boutonAjouter)
    if (cartes!=undefined) {
	for (var i=0;i<cartes.questions.length; i++) {
	    nextChild=ajouterQuestion(nextChild,
				      cartes.questions[i].question,
				      cartes.questions[i].questionEstURL,
				      cartes.questions[i].réponse,
				      cartes.questions[i].réponseEstURL)
	}
    }
    if (cartes==undefined || cartes.questions.length==0) {
	ajouterQuestion(nextChild,"",false,"",false)
    }
}

/* Vue et controlleurs statistiques */

function formatterRésultats(nombreJustes, nombreFaux) {
    var pourcentage="--"
    if (nombreJustes+nombreFaux!=0) {
	pourcentage=Math.floor(100*nombreJustes/(nombreJustes+nombreFaux))
    }
    return nombreJustes+"/"+(nombreJustes+nombreFaux)+" ("+pourcentage+"%)"
}

function mettreStatistiquesÀJour() {
    pStatistiques.innerText=formatterRésultats(étatGlobal.nombreJustes,étatGlobal.nombreDErreurs)
    if (étatDeRonde!=undefined) {
	pStatistiques.innerText+=" - Ronde: "+formatterRésultats(étatDeRonde.nombreJustes,étatDeRonde.nombreDErreurs)
	pStatistiques.innerText+=" - Rondes faites: "+étatGlobal.rondesFaites
	pStatistiques.innerText+=" - Nombre de questions: "+étatDeRonde.questions.length
    }
}

montrerLaConfiguration()

/* Quand on appuye sur reload ayant déjà ouvert un document, le
 * document est déjà sélectioné mais il reste à le lire */
if (documentÀOuvrir.files.length!=0) {
    ouvrirDocument(documentÀOuvrir.files[0],miseÀJour)
}

