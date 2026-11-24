#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fabrique les données d'exemple des rubriques (livre, arbre, voix, archives, films)
dans data/demo/. Tout est inventé : la famille « Ferrer » est la même que celle
du jeu d'exemple de la photothèque, pour que les liens entre pages fonctionnent.

  python3 outils/creer_demo_rubriques.py

Chaque rubrique produit deux fichiers : <rubrique>.json (lisible) et <rubrique>.js
(chargé par la page). Les vraies données suivront le même modèle dans prive/.
"""
import json
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "data" / "demo"

# Appellations utilisées dans la photothèque d'exemple
A = "Antoinette Ferrer (Mamie Toinette)"
J = "Joseph Ferrer"
L = "Lucienne Ferrer"
P = "Paul Ferrer"
R = "Rose Soler"
M = "Marcel Soler"
H = "Hélène Ferrer"
V = "Pierre Vidal"


def chap(numero, titre, page, annees=""):
    d = {"numero": numero, "titre": titre, "page": page}
    if annees:
        d["annees"] = annees
    return d


LIVRE = {
    "titre": "Souvenirs d'Antoinette",
    "sous_titre": "Livre d'exemple",
    "liminaires": [{"titre": "Prologue", "page": 9}],
    "parties": [
        {"numero": 1, "titre": "Avant moi", "annees": "1895 – 1922", "chapitres": [chap(1, "Les grands-parents", 13, "1895 – 1922")]},
        {"numero": 2, "titre": "L'Algérie", "annees": "1923 – 1946", "chapitres": [
            chap(2, "L'enfance à Oran", 21, "1923 – 1934"), chap(3, "L'école", 34, "1929 – 1937"), chap(4, "La guerre", 47, "1939 – 1945"),
            chap(5, "Le mariage", 58, "1946")]},
        {"numero": 3, "titre": "Le Maroc", "annees": "1947 – 1957", "chapitres": [
            chap(6, "Casablanca", 72, "1947 – 1953"), chap(7, "Les enfants grandissent", 88, "1953 – 1957")]},
        {"numero": 4, "titre": "La France", "annees": "1957 – 2015", "chapitres": [
            chap(8, "Le départ pour la France", 101, "1957"), chap(9, "Tout recommencer", 112, "1957 – 1962"),
            chap(10, "Le retour au pays des ancêtres", 127, "1962"), chap(11, "Les mariages des enfants", 139, "1968 – 1975"),
            chap(12, "Les petits-enfants", 150, "1976 – 2015")]},
    ],
    "annexes": [{"titre": "Généalogie", "page": 161}],
}


def personne(id, prenoms, nom, **k):
    d = {"id": id, "prenoms": prenoms, "nom": nom}
    d.update(k)
    return d


ARBRE = {
    "racine": "antoinette-ferrer",
    "personnes": [
        personne("jean-ferrer", "Jean", "Ferrer", sexe="M", naissance={"date": "vers 1890", "lieu": "Mostaganem, Algérie"},
                 deces={"date": "1950", "lieu": "Mostaganem, Algérie"}, conjoints=["marie-ferrer"],
                 certitude="à vérifier", bio="Cultivateur près de Mostaganem."),
        personne("marie-ferrer", "Marie", "Ruiz", sexe="F", nom_usage="Ferrer", naissance={"date": "vers 1894"},
                 conjoints=["jean-ferrer"], certitude="à vérifier"),
        personne("marcel-soler", "Marcel", "Soler", sexe="M", naissance={"date": "vers 1895", "lieu": "Valence, Espagne"},
                 deces={"date": "1961", "lieu": "Perpignan, France"}, conjoints=["rose-soler"], photos=[M],
                 bio="Parti de Valence pour l'Algérie vers 1914, il a travaillé au port d'Oran.",
                 sources=["Acte de mariage (1921)"], certitude="confirmé"),
        personne("rose-soler", "Rose", "Martí", sexe="F", nom_usage="Soler", naissance={"date": "1899", "lieu": "Oran, Algérie"},
                 deces={"date": "1975", "lieu": "Perpignan, France"}, conjoints=["marcel-soler"], photos=[R],
                 certitude="confirmé"),
        personne("joseph-ferrer", "Joseph", "Ferrer", sexe="M", naissance={"date": "1920", "lieu": "Mostaganem, Algérie"},
                 deces={"date": "1998", "lieu": "Perpignan, France"}, parents=["jean-ferrer", "marie-ferrer"],
                 conjoints=["antoinette-ferrer"], photos=[J],
                 bio="Mécanicien. Mobilisé en 1942, il épouse Antoinette à son retour.",
                 sources=["Acte de mariage (1946)", "Livret de famille"], certitude="confirmé"),
        personne("antoinette-ferrer", "Antoinette", "Soler", sexe="F", nom_usage="Ferrer", surnom="Mamie Toinette",
                 naissance={"date": "12 mars 1923", "lieu": "Oran, Algérie"},
                 deces={"date": "2015", "lieu": "Perpignan, France"}, parents=["marcel-soler", "rose-soler"],
                 conjoints=["joseph-ferrer"], photos=[A],
                 bio="C'est elle qui raconte le livre d'exemple : l'enfance à Oran, Casablanca, puis la France.",
                 sources=["Livret de famille", "Ses cahiers"], certitude="confirmé"),
        personne("helene-ferrer", "Hélène", "Ferrer", sexe="F", naissance={"date": "1925", "lieu": "Mostaganem, Algérie"},
                 deces={"date": "2004", "lieu": "Montpellier, France"}, parents=["jean-ferrer", "marie-ferrer"],
                 photos=[H], bio="Sœur de Joseph et grande amie d'Antoinette.", certitude="confirmé"),
        personne("lucienne-vidal", "Lucienne", "Ferrer", sexe="F", nom_usage="Vidal", vivant=True,
                 naissance={"lieu": "Casablanca, Maroc"}, parents=["joseph-ferrer", "antoinette-ferrer"],
                 conjoints=["pierre-vidal"], photos=[L], certitude="confirmé"),
        personne("paul-ferrer", "Paul", "Ferrer", sexe="M", vivant=True, naissance={"lieu": "Casablanca, Maroc"},
                 parents=["joseph-ferrer", "antoinette-ferrer"], photos=[P], certitude="confirmé"),
        personne("pierre-vidal", "Pierre", "Vidal", sexe="M", vivant=True, conjoints=["lucienne-vidal"], photos=[V],
                 certitude="confirmé"),
    ],
}

VOIX = {
    "modele": 2,
    "extraits": [
        {"id": "v01", "titre": "La rue de la Mer", "chapitre": {"numero": 2, "titre": "L'enfance à Oran"}, "type": "livre",
         "enregistrement": {"code": "E03", "titre": "Enregistrement 03", "fichier": "Enregistrement 03.m4a", "date": "14 août 2009", "par": "Lucienne"},
         "coupes": ["12:40,00–14:05,00"], "debut": "12:40", "fin": "14:05", "duree": "1:25",
         "resume": "Antoinette décrit la rue de son enfance et les voisins qui se retrouvaient le soir devant les portes.",
         "transcription": "Antoinette : Le soir, tout le monde sortait les chaises. Les femmes parlaient, les enfants couraient "
                          "jusqu'au bout de la rue.\nLucienne : Et ta mère ?\nAntoinette : Elle restait sur le pas de la porte, elle surveillait. "
                          "On n'avait pas besoin de la télévision, on avait la rue !",
         "note_transcription": "Exemple fictif de transcription relue.",
         "personnes": [R, "Lucienne"], "lieux": ["Oran"], "statut": "à monter"},
        {"id": "v02", "titre": "Le jour du mariage", "chapitre": {"numero": 5, "titre": "Le mariage"}, "type": "livre",
         "enregistrement": {"code": "E04", "titre": "Enregistrement 04", "fichier": "Enregistrement 04.m4a", "date": "14 août 2009", "par": "Lucienne"},
         "coupes": ["03:10,00–04:02,00", "04:20,00–05:02,00"], "debut": "03:10", "fin": "05:02", "duree": "1:34",
         "resume": "La pluie du matin, la robe prêtée par une cousine et le repas dans la cour.",
         "transcription": "Il a plu toute la matinée, je pleurais, je disais : c'est fichu ! Et puis à midi, le "
                          "soleil.\n[…]\nLa robe, c'était celle de ma cousine, on l'avait reprise à la taille. Le repas, "
                          "on l'a fait dans la cour, avec les tables des voisins.",
         "divergences": ["À l'oral, le mariage a lieu en mai ; le livre le date de juin 1946."],
         "personnes": [A, J], "lieux": ["Oran"], "statut": "monté"},
        {"id": "v03", "titre": "Deux valises", "chapitre": {"numero": 8, "titre": "Le départ pour la France"}, "type": "livre",
         "enregistrement": {"code": "E07", "titre": "Enregistrement 07", "fichier": "Enregistrement 07.m4a", "date": "26 décembre 2011", "par": "Paul"},
         "coupes": ["21:15,00–22:40,00"], "debut": "21:15", "fin": "22:40", "duree": "1:25",
         "resume": "Ce que l'on emporte quand on n'a droit qu'à deux valises.",
         "transcription": "On avait droit à deux valises. Alors on choisit : les photos, oui. Les draps brodés, oui. "
                          "Le reste, on l'a laissé. Ton père disait : on rachètera. On n'a jamais racheté, mais on "
                          "s'est débrouillés.",
         "personnes": [J], "lieux": ["Casablanca", "Marseille"], "statut": "à monter"},
        {"id": "v04", "titre": "Les recettes", "chapitre": {"numero": 12, "titre": "Les petits-enfants"}, "type": "complément",
         "enregistrement": {"code": "E08", "titre": "Enregistrement 08", "fichier": "Enregistrement 08.m4a", "date": "26 décembre 2011", "par": "Paul"},
         "coupes": ["00:30,00–01:45,00"], "debut": "00:30", "fin": "01:45", "duree": "1:15",
         "resume": "Les recettes qu'elle n'a jamais écrites, et pourquoi. Le livre n'en parle qu'en une phrase.",
         "transcription": "Les quantités ? Il n'y a pas de quantités. Tu regardes, tu goûtes. Ma mère faisait "
                          "comme ça, et sa mère avant elle. Si je l'écris, ce n'est plus pareil.",
         "personnes": [A], "lieux": ["Perpignan"], "statut": "brut"},
        {"id": "v05", "titre": "La chanson du marchand de glaces", "chapitre": None, "type": "hors livre",
         "enregistrement": {"code": "E08", "titre": "Enregistrement 08", "fichier": "Enregistrement 08.m4a", "date": "26 décembre 2011", "par": "Paul"},
         "coupes": ["06:02,00–06:40,00"], "debut": "06:02", "fin": "06:40", "duree": "0:38",
         "resume": "Antoinette chante l'air que sifflait le marchand de glaces de son quartier. Un souvenir que le livre ne raconte pas.",
         "personnes": [A], "lieux": ["Oran"], "statut": "brut"},
    ]
}

ARCHIVES = {
    "types": {
        "acte": "Actes d'état civil",
        "lettre": "Lettres",
        "papier": "Papiers de famille",
        "article": "Articles de presse",
        "carte": "Cartes et plans",
    },
    "documents": [
        {"id": "a01", "type": "acte", "titre": "Acte de mariage de Joseph Ferrer et Antoinette Soler",
         "date": {"libelle": "11 mai 1946", "annee": 1946}, "lieu": "Oran, Algérie", "personnes": [J, A],
         "chapitre": {"numero": 5, "titre": "Le mariage"},
         "source": "Copie intégrale demandée au service central d'état civil",
         "description": "Mentionne les parents des deux époux et les témoins.", "droits": "Usage familial"},
        {"id": "a02", "type": "lettre", "titre": "Lettre de Joseph à Antoinette",
         "date": {"libelle": "mars 1944", "annee": 1944}, "lieu": "Italie", "personnes": [J, A],
         "chapitre": {"numero": 4, "titre": "La guerre"}, "source": "Boîte à lettres de la famille",
         "description": "Quatre pages ; il y parle du froid et de la permission espérée.", "droits": "Usage familial"},
        {"id": "a03", "type": "papier", "titre": "Livret de famille Ferrer",
         "date": {"libelle": "1946", "annee": 1946}, "lieu": "Oran, Algérie", "personnes": [J, A, L, P],
         "chapitre": {"numero": 6, "titre": "Casablanca"}, "source": "Papiers de famille",
         "description": "Naissances des enfants ajoutées à Casablanca.", "droits": "Usage familial"},
        {"id": "a04", "type": "papier", "titre": "Billet de traversée Casablanca – Marseille",
         "date": {"libelle": "septembre 1957", "annee": 1957}, "lieu": "Casablanca, Maroc", "personnes": [J, A, L, P],
         "chapitre": {"numero": 8, "titre": "Le départ pour la France"}, "source": "Papiers de famille",
         "description": "Quatre passagers, pont C.", "droits": "Usage familial"},
        {"id": "a05", "type": "article", "titre": "La kermesse de la paroisse",
         "date": {"libelle": "juin 1955", "annee": 1955}, "lieu": "Casablanca, Maroc", "personnes": [A],
         "chapitre": {"numero": 7, "titre": "Les enfants grandissent"}, "source": "Coupure de journal conservée",
         "description": "Antoinette tenait le stand des pâtisseries.", "droits": "Droits à vérifier avant diffusion"},
        {"id": "a06", "type": "carte", "titre": "Plan du quartier de la rue de la Mer",
         "date": {"libelle": "vers 1930", "annee": 1930}, "lieu": "Oran, Algérie", "personnes": [],
         "chapitre": {"numero": 2, "titre": "L'enfance à Oran"}, "source": "Reproduction d'un plan ancien",
         "description": "La maison de la famille Soler est entourée au crayon.", "droits": "Droits à vérifier avant diffusion"},
    ],
}

FILMS = {
    "films": [
        {"id": "f01", "titre": "Vacances à la plage", "date": {"libelle": "été 1956", "annee": 1956},
         "lieu": "Mohammédia, Maroc", "support": "Super 8", "duree": "3 min 40", "statut": "à numériser",
         "description": "Une journée à la plage avec les enfants et Hélène.",
         "sequences": [{"debut": "0:00", "titre": "L'arrivée à la plage"},
                       {"debut": "1:10", "titre": "Les enfants dans les vagues"},
                       {"debut": "2:30", "titre": "Le pique-nique"}],
         "personnes": [L, P, H], "chapitre": {"numero": 7, "titre": "Les enfants grandissent"}},
        {"id": "f02", "titre": "Le mariage de Lucienne et Pierre", "date": {"libelle": "20 avril 1968", "annee": 1968},
         "lieu": "Montpellier, France", "support": "Super 8", "duree": "6 min", "statut": "à numériser",
         "description": "La sortie de la mairie, puis le repas.",
         "sequences": [{"debut": "0:00", "titre": "La sortie de la mairie"},
                       {"debut": "2:15", "titre": "Les photos de groupe"},
                       {"debut": "3:50", "titre": "Le repas"}],
         "personnes": [L, V, A, J], "chapitre": {"numero": 11, "titre": "Les mariages des enfants"}},
    ]
}

RUBRIQUES = {"livre": ("LIVRE", LIVRE), "arbre": ("ARBRE", ARBRE), "voix": ("VOIX", VOIX),
             "archives": ("ARCHIVES", ARCHIVES), "films": ("FILMS", FILMS)}


def main():
    SORTIE.mkdir(parents=True, exist_ok=True)
    for nom, (variable, contenu) in RUBRIQUES.items():
        donnees = {"modele": 1, "mode": "demo", **contenu}
        (SORTIE / f"{nom}.json").write_text(json.dumps(donnees, ensure_ascii=False, indent=1) + "\n",
                                            encoding="utf-8")
        (SORTIE / f"{nom}.js").write_text(
            f"/* Données d'exemple fictives. Générées par outils/creer_demo_rubriques.py */\n"
            f"window.{variable} = " + json.dumps(donnees, ensure_ascii=False, separators=(",", ":")) + ";\n",
            encoding="utf-8")
        print(f"data/demo/{nom}.js")


if __name__ == "__main__":
    main()
