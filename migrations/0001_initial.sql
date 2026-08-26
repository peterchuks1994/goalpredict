PRAGMA foreign_keys = ON;

CREATE TABLE competitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    country TEXT,
    country_code TEXT,
    competition_code TEXT,
    type TEXT,
    logo_url TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competition_id INTEGER NOT NULL,
    provider_id INTEGER,
    name TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    current INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (competition_id)
        REFERENCES competitions(id)
        ON DELETE CASCADE,

    UNIQUE (competition_id, provider_id)
);

CREATE TABLE teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    short_name TEXT,
    slug TEXT NOT NULL UNIQUE,
    country TEXT,
    crest_url TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE team_seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    competition_id INTEGER NOT NULL,
    season_id INTEGER NOT NULL,
    squad_status TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (team_id)
        REFERENCES teams(id)
        ON DELETE CASCADE,

    FOREIGN KEY (competition_id)
        REFERENCES competitions(id)
        ON DELETE CASCADE,

    FOREIGN KEY (season_id)
        REFERENCES seasons(id)
        ON DELETE CASCADE,

    UNIQUE (team_id, competition_id, season_id)
);

CREATE TABLE matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER UNIQUE,

    competition_id INTEGER NOT NULL,
    season_id INTEGER NOT NULL,
    matchday INTEGER,

    home_team_id INTEGER NOT NULL,
    away_team_id INTEGER NOT NULL,

    kickoff_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SCHEDULED',

    home_score INTEGER,
    away_score INTEGER,

    winner TEXT,
    duration TEXT,

    venue TEXT,
    referee_name TEXT,

    provider_last_updated_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (competition_id)
        REFERENCES competitions(id),

    FOREIGN KEY (season_id)
        REFERENCES seasons(id),

    FOREIGN KEY (home_team_id)
        REFERENCES teams(id),

    FOREIGN KEY (away_team_id)
        REFERENCES teams(id),

    CHECK (home_team_id != away_team_id)
);

CREATE TABLE team_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    team_id INTEGER NOT NULL,
    competition_id INTEGER NOT NULL,
    season_id INTEGER NOT NULL,

    matches_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,

    goals_for INTEGER NOT NULL DEFAULT 0,
    goals_against INTEGER NOT NULL DEFAULT 0,

    goal_difference INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,

    clean_sheets INTEGER NOT NULL DEFAULT 0,
    btts_matches INTEGER NOT NULL DEFAULT 0,

    over_15_matches INTEGER NOT NULL DEFAULT 0,
    over_25_matches INTEGER NOT NULL DEFAULT 0,
    over_35_matches INTEGER NOT NULL DEFAULT 0,

    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (team_id)
        REFERENCES teams(id),

    FOREIGN KEY (competition_id)
        REFERENCES competitions(id),

    FOREIGN KEY (season_id)
        REFERENCES seasons(id),

    UNIQUE (team_id, competition_id, season_id)
);

CREATE TABLE team_form (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    team_id INTEGER NOT NULL,
    competition_id INTEGER NOT NULL,
    season_id INTEGER NOT NULL,

    matches_considered INTEGER NOT NULL DEFAULT 0,

    wins INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,

    goals_for INTEGER NOT NULL DEFAULT 0,
    goals_against INTEGER NOT NULL DEFAULT 0,

    points INTEGER NOT NULL DEFAULT 0,

    form_string TEXT,

    calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (team_id)
        REFERENCES teams(id),

    FOREIGN KEY (competition_id)
        REFERENCES competitions(id),

    FOREIGN KEY (season_id)
        REFERENCES seasons(id),

    UNIQUE (team_id, competition_id, season_id)
);

CREATE TABLE model_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,
    version TEXT NOT NULL UNIQUE,

    description TEXT,

    status TEXT NOT NULL DEFAULT 'TESTING',

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retired_at TEXT
);

CREATE TABLE predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    match_id INTEGER NOT NULL,
    model_version_id INTEGER NOT NULL,

    generated_at TEXT NOT NULL,

    home_probability REAL NOT NULL,
    draw_probability REAL NOT NULL,
    away_probability REAL NOT NULL,

    over_15_probability REAL,
    over_25_probability REAL,
    over_35_probability REAL,

    under_25_probability REAL,

    btts_yes_probability REAL,
    btts_no_probability REAL,

    recommended_market TEXT,
    recommended_selection TEXT,

    signal_strength TEXT,
    data_confidence TEXT,

    model_score REAL,

    explanation TEXT,

    status TEXT NOT NULL DEFAULT 'ACTIVE',

    FOREIGN KEY (match_id)
        REFERENCES matches(id)
        ON DELETE CASCADE,

    FOREIGN KEY (model_version_id)
        REFERENCES model_versions(id),

    UNIQUE (match_id, model_version_id)
);

CREATE TABLE prediction_features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    prediction_id INTEGER NOT NULL,

    feature_name TEXT NOT NULL,

    home_value REAL,
    away_value REAL,

    weight REAL,
    contribution REAL,

    FOREIGN KEY (prediction_id)
        REFERENCES predictions(id)
        ON DELETE CASCADE
);

CREATE TABLE prediction_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    prediction_id INTEGER NOT NULL,
    match_id INTEGER NOT NULL,

    market TEXT NOT NULL,
    selection TEXT NOT NULL,

    predicted_probability REAL,

    actual_outcome TEXT,

    correct INTEGER,

    settled_at TEXT,

    FOREIGN KEY (prediction_id)
        REFERENCES predictions(id)
        ON DELETE CASCADE,

    FOREIGN KEY (match_id)
        REFERENCES matches(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_matches_kickoff
ON matches(kickoff_at);

CREATE INDEX idx_matches_status
ON matches(status);

CREATE INDEX idx_matches_competition
ON matches(competition_id);

CREATE INDEX idx_matches_home_team
ON matches(home_team_id);

CREATE INDEX idx_matches_away_team
ON matches(away_team_id);

CREATE INDEX idx_predictions_match
ON predictions(match_id);

CREATE INDEX idx_predictions_generated
ON predictions(generated_at);

CREATE INDEX idx_prediction_results_match
ON prediction_results(match_id);

CREATE INDEX idx_team_form_team
ON team_form(team_id);

CREATE INDEX idx_team_statistics_team
ON team_statistics(team_id);
