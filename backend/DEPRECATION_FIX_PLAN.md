# Deprecation Warnings Fix Plan

## Overview
The backend test suite shows several deprecation warnings that need to be addressed to ensure compatibility with future versions of dependencies.

## Identified Deprecation Warnings

### 1. Pydantic V2 Migration Issues

#### A. Class-based Config → ConfigDict
**Location**: Multiple schema classes in `app/schemas.py`
**Warning**: `Support for class-based config is deprecated, use ConfigDict instead`
**Fix**: Replace `class Config:` with `model_config = ConfigDict(...)`

#### B. `.dict()` → `.model_dump()`
**Location**: `app/crud.py:56`
**Warning**: `The dict method is deprecated; use model_dump instead`
**Fix**: Replace `artist.dict()` with `artist.model_dump()`

#### C. `.from_orm()` → `.model_validate()`
**Location**: `app/routers/uploads.py:1184`
**Warning**: `The from_orm method is deprecated; set model_config['from_attributes']=True and use model_validate instead`
**Fix**: Replace `Mix.from_orm(db_mix)` with `Mix.model_validate(db_mix)`

### 2. SQLAlchemy V2 Migration Issues

#### A. declarative_base() Import
**Location**: `app/db/database.py:26`
**Warning**: `declarative_base() function is now available as sqlalchemy.orm.declarative_base()`
**Fix**: Update import to use `from sqlalchemy.orm import declarative_base`

#### B. datetime.utcnow() Deprecation
**Location**: SQLAlchemy schema default (models.py)
**Warning**: `datetime.datetime.utcnow() is deprecated`
**Fix**: Replace with `datetime.datetime.now(datetime.UTC)`

## Implementation Priority

### High Priority (Breaking Changes in Next Major Version)
1. Pydantic ConfigDict migration
2. Pydantic method migrations (.dict() → .model_dump(), .from_orm() → .model_validate())

### Medium Priority (Will Work But Deprecated)
3. SQLAlchemy declarative_base import
4. datetime.utcnow() replacement

## Implementation Steps

### Step 1: Update Pydantic Schemas
- Convert all `class Config:` to `model_config = ConfigDict(from_attributes=True)`
- Update all schema classes in `app/schemas.py`

### Step 2: Update CRUD Operations
- Replace `.dict()` calls with `.model_dump()` in `app/crud.py`

### Step 3: Update Upload Router
- Replace `.from_orm()` with `.model_validate()` in `app/routers/uploads.py`

### Step 4: Update Database Configuration
- Update SQLAlchemy import in `app/db/database.py`

### Step 5: Update Model Defaults
- Replace `datetime.datetime.utcnow` with `datetime.datetime.now(datetime.UTC)` in `app/models/models.py`

### Step 6: Test All Changes
- Run full test suite to ensure no regressions
- Verify all deprecation warnings are resolved

## Files to Modify
1. `app/schemas.py` - Pydantic schema configs
2. `app/crud.py` - Model serialization
3. `app/routers/uploads.py` - ORM to Pydantic conversion
4. `app/db/database.py` - SQLAlchemy imports
5. `app/models/models.py` - DateTime defaults

## Testing Strategy
- Run tests after each step to catch any breaking changes early
- Focus on upload functionality since it's most complex
- Verify API responses remain unchanged
